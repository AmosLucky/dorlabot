<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\Broadcast;
use App\Models\BroadcastRecipient;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Models\TrackedLink;
use App\Jobs\ProcessBroadcastRecipient;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Broadcast pipeline: audience building with eligibility filtering,
 * recipient queueing, lifecycle transitions and analytics rollups.
 */
class BroadcastService
{
    public function __construct(
        private readonly MessagingEligibilityService $eligibility,
        private readonly MessageTemplateService $templates,
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Build the audience for a page with optional tag filter and
     * pre-compute eligibility stats (does NOT send).
     *
     * @return array{contacts: Collection, eligible: Collection, skipped: array}
     */
    public function buildAudience(FacebookPage $page, ?array $tagIds = null, ?string $messageTag = null): array
    {
        $query = MessengerContact::where('facebook_page_id', $page->id)->whereNull('deleted_at');

        if (! empty($tagIds)) {
            $query->whereHas('tags', fn ($q) => $q->whereIn('contact_tags.id', $tagIds));
        }

        $contacts = $query->orderBy('id')->get();

        $result = $this->eligibility->filterBroadcastAudience($contacts, $messageTag);

        return [
            'contacts' => $contacts,
            'eligible' => $result['eligible'],
            'skipped' => $result['skipped'],
        ];
    }

    /**
     * Queue a broadcast: freeze the recipient list with skip reasons,
     * create the tracking link, and dispatch per-recipient jobs.
     */
    public function queue(Broadcast $broadcast): Broadcast
    {
        $page = $broadcast->page;

        $audience = $this->buildAudience($page, $broadcast->tag_filter, $broadcast->message_tag);

        DB::transaction(function () use ($broadcast, $audience): void {
            foreach ($audience['eligible'] as $contact) {
                BroadcastRecipient::firstOrCreate(
                    ['broadcast_id' => $broadcast->id, 'recipient_psid' => $contact->psid],
                    [
                        'messenger_contact_id' => $contact->id,
                        'status' => 'pending',
                    ],
                );
            }

            foreach ($audience['skipped'] as $skip) {
                BroadcastRecipient::firstOrCreate(
                    ['broadcast_id' => $broadcast->id, 'recipient_psid' => $skip['contact']->psid],
                    [
                        'messenger_contact_id' => $skip['contact']->id,
                        'status' => 'skipped',
                        'skip_reason' => Str::limit($skip['reason'], 240),
                    ],
                );
            }

            $broadcast->forceFill([
                'status' => $broadcast->scheduled_at && $broadcast->scheduled_at->gt(now())
                    ? Broadcast::STATUS_SCHEDULED
                    : Broadcast::STATUS_QUEUED,
                'estimated_recipients' => $audience['contacts']->count(),
                'eligible_recipients' => $audience['eligible']->count(),
                'skipped_recipients' => $audience['skipped']->count(),
                'audience_description' => $audience['contacts']->count().' contacts on '.$broadcast->page->name,
            ])->save();
        });

        // Per-recipient sending is queued immediately for immediate sends;
        // scheduled sends are dispatched by the scheduler when due.
        if ($broadcast->status === Broadcast::STATUS_QUEUED) {
            $this->dispatchRecipientJobs($broadcast);
        }

        $this->logger->info('broadcast.queued', "Broadcast #{$broadcast->id} queued: {$broadcast->eligible_recipients} eligible / {$broadcast->skipped_recipients} skipped", [], $broadcast->user_id, $broadcast->facebook_page_id);

        return $broadcast->refresh();
    }

    public function dispatchRecipientJobs(Broadcast $broadcast): void
    {
        $jobs = $broadcast->recipients()
            ->where('status', 'pending')
            ->pluck('id')
            ->map(fn ($id) => ProcessBroadcastRecipient::dispatch((int) $id)->onQueue('broadcasts'));

        $broadcast->forceFill([
            'status' => Broadcast::STATUS_SENDING,
            'started_at' => $broadcast->started_at ?? now(),
        ])->save();
    }

    /**
     * Called by the scheduler: queue all due scheduled broadcasts.
     */
    public static function queueDueScheduled(): void
    {
        Broadcast::where('status', Broadcast::STATUS_SCHEDULED)
            ->where('scheduled_at', '<=', now())
            ->chunkById(20, function ($broadcasts): void {
                /** @var Broadcast $broadcast */
                foreach ($broadcasts as $broadcast) {
                    app(self::class)->queue($broadcast);
                }
            });
    }

    /**
     * Process one recipient (called by the queue job). Re-checks eligibility
     * per Meta policy right before sending — never bypass messaging rules.
     */
    public function processRecipient(BroadcastRecipient $recipient): BroadcastRecipient
    {
        if ($recipient->status !== 'pending') {
            return $recipient;
        }

        $broadcast = $recipient->broadcast;
        $page = $broadcast->page;

        if (! in_array($broadcast->status, [Broadcast::STATUS_SENDING, Broadcast::STATUS_QUEUED], true)) {
            return $recipient; // paused/cancelled: leave pending
        }

        $contact = $recipient->messenger_contact_id
            ? MessengerContact::withTrashed()->find($recipient->messenger_contact_id)
            : null;

        // Re-evaluate eligibility at send time (window may have closed).
        $evaluation = $this->eligibility->evaluate($contact, $broadcast->message_tag);
        if (! $evaluation['allowed']) {
            $recipient->forceFill([
                'status' => 'skipped',
                'skip_reason' => Str::limit((string) $evaluation['reason'], 240),
            ])->save();

            $broadcast->increment('skipped_recipients');

            return $recipient;
        }

        // Render + rewrite links with tracking codes.
        $renderedText = $this->templates->render((string) $broadcast->message_text, $contact, $page);
        $renderedText = $this->rewriteLinksForTracking($broadcast, $renderedText, $recipient);

        $sendService = app(\App\Services\MessengerSendService::class);
        $result = $sendService->send(
            $page,
            $recipient->recipient_psid,
            ['text' => $renderedText],
            $contact,
            $broadcast->message_tag,
            $broadcast,
        );

        if ($result['ok']) {
            $recipient->forceFill([
                'status' => 'sent',
                'sent_at' => now(),
                'meta_message_id' => $result['message_event']->meta_message_id,
                'is_simulated' => $result['simulated'],
            ])->save();

            $broadcast->increment('sent_count');

            if ($contact !== null) {
                $contact->forceFill(['last_messaged_at' => now()])->save();
            }
        } else {
            $recipient->forceFill([
                'status' => 'failed',
                'error_message' => Str::limit((string) $result['error'], 240),
            ])->save();

            $broadcast->increment('failed_count');
        }

        return $recipient;
    }

    /**
     * Replace plain URLs in broadcast text with first-party tracked links.
     */
    protected function rewriteLinksForTracking(Broadcast $broadcast, string $text, BroadcastRecipient $recipient): string
    {
        return preg_replace_callback(
            '/https?:\/\/[^\s<>"\']+/i',
            function (array $matches) use ($broadcast, $recipient): string {
                $url = $matches[0];

                // Never track our own tracking links.
                if (str_contains($url, '/c/')) {
                    return $url;
                }

                $link = TrackedLink::create([
                    'user_id' => $broadcast->user_id,
                    'facebook_page_id' => $broadcast->facebook_page_id,
                    'broadcast_id' => $broadcast->id,
                    'tracking_code' => Str::random(12),
                    'destination_url' => $url,
                    'label' => 'Broadcast: '.$broadcast->name,
                ]);

                return $link->trackingUrl();
            },
            $text,
        ) ?? $text;
    }

    /**
     * Lifecycle transitions.
     */
    public function pause(Broadcast $broadcast): void
    {
        if ($broadcast->status === Broadcast::STATUS_SENDING) {
            $broadcast->forceFill(['status' => Broadcast::STATUS_PAUSED])->save();
        }
    }

    public function resume(Broadcast $broadcast): void
    {
        if ($broadcast->status === Broadcast::STATUS_PAUSED) {
            $this->dispatchRecipientJobs($broadcast);
        }
    }

    public function cancel(Broadcast $broadcast): void
    {
        if (in_array($broadcast->status, [Broadcast::STATUS_SCHEDULED, Broadcast::STATUS_QUEUED, Broadcast::STATUS_PAUSED, Broadcast::STATUS_SENDING], true)) {
            $broadcast->forceFill(['status' => Broadcast::STATUS_CANCELLED, 'completed_at' => now()])->save();

            $broadcast->recipients()->where('status', 'pending')->update(['status' => 'skipped', 'skip_reason' => 'Broadcast cancelled']);
        }
    }

    /**
     * Roll up delivery/read/click counts (called by AggregateCampaignAnalytics).
     */
    public function recalculateStatistics(Broadcast $broadcast): void
    {
        $stats = $broadcast->recipients()
            ->selectRaw("
                SUM(CASE WHEN status IN ('sent','delivered','read','clicked') THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status IN ('delivered','read','clicked') THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status IN ('read','clicked') THEN 1 ELSE 0 END) as `read`,
                SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked
            ")
            ->first();

        $broadcast->forceFill([
            'sent_count' => (int) ($stats->sent ?? 0),
            'delivered_count' => (int) ($stats->delivered ?? 0),
            'read_count' => (int) ($stats->read ?? 0),
            'clicked_count' => (int) ($stats->clicked ?? 0),
        ])->save();
    }
}
