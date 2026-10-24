<?php

namespace App\Jobs;

use App\Models\Conversation;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Models\MessageEvent;
use App\Services\AutomationEngine;
use App\Services\MessagingEligibilityService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Handles a single messaging entry event: inbound messages, postbacks,
 * optins, deliveries and reads.
 */
class ProcessIncomingMessage implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [5, 30];

    public function __construct(
        public int $facebookPageId,
        public array $event,
        public bool $isStandby = false,
    ) {}

    public function handle(
        AutomationEngine $engine,
        MessagingEligibilityService $eligibility,
    ): void {
        $page = FacebookPage::find($this->facebookPageId);

        if ($page === null || $page->status === FacebookPage::STATUS_DISABLED) {
            return;
        }

        $senderPsid = (string) ($this->event['sender']['id'] ?? '');

        // Events where the PAGE is the sender are echo/outbound reflections — skip.
        if ($senderPsid === (string) $page->meta_page_id) {
            return;
        }

        if ($senderPsid === '') {
            return;
        }

        $contact = $this->upsertContact($page, $senderPsid, $this->event);

        // Delivery receipts.
        if (isset($this->event['delivery']['mids'])) {
            MessageEvent::whereIn('meta_message_id', $this->event['delivery']['mids'])
                ->where('facebook_page_id', $page->id)
                ->update(['status' => MessageEvent::STATUS_DELIVERED, 'delivered_at' => now()]);

            $this->updateBroadcastStats($this->event['delivery']['mids'], 'delivered');

            return;
        }

        // Read receipts.
        if (isset($this->event['read']['watermark'])) {
            MessageEvent::where('facebook_page_id', $page->id)
                ->where('direction', MessageEvent::DIRECTION_OUT)
                ->whereNotNull('meta_message_id')
                ->where('status', '!=', MessageEvent::STATUS_READ)
                ->chunkById(200, function ($events) use ($page, $eligibility): void {
                    // watermark comparison happens against event timestamps;
                    // simplified: mark all earlier outbound messages read
                    foreach ($events as $event) {
                        $event->forceFill([
                            'status' => MessageEvent::STATUS_READ,
                            'read_at' => now(),
                        ])->save();
                    }
                });

            $this->markBroadcastRecipientsRead($page);

            return;
        }

        // Referral entry (m.me link with referral param) — just record contact.
        if (isset($this->event['referral'])) {
            $contact->forceFill(['last_interaction_at' => now()])->save();

            return;
        }

        // Opt-in (checkbox plugin / opt-in postback).
        if (isset($this->event['optin'])) {
            $eligibility->recordOptIn($contact, (string) ($this->event['optin']['ref'] ?? 'general'), 'optin_event');

            return;
        }

        if ($this->isStandby) {
            // Human-agent standby events are not auto-answered.
            $contact->forceFill(['last_interaction_at' => now()])->save();

            return;
        }

        // Inbound message or postback → update conversation state.
        $messageText = (string) ($this->event['message']['text'] ?? '');
        $postbackPayload = $this->event['postback']['payload'] ?? null;
        $isPostback = isset($this->event['postback']);

        $conversation = Conversation::firstOrCreate(
            ['facebook_page_id' => $page->id, 'messenger_contact_id' => $contact->id],
            ['user_id' => $page->user_id, 'status' => 'open'],
        );

        // Persist the inbound message event.
        if ($messageText !== '' || $isPostback) {
            MessageEvent::create([
                'user_id' => $page->user_id,
                'facebook_page_id' => $page->id,
                'messenger_contact_id' => $contact->id,
                'conversation_id' => $conversation->id,
                'direction' => MessageEvent::DIRECTION_IN,
                'meta_message_id' => $this->event['message']['mid'] ?? null,
                'recipient_psid' => $senderPsid,
                'message_text' => $messageText !== '' ? $messageText : '[postback: '.$postbackPayload.']',
                'message_type' => $isPostback ? 'postback' : 'text',
                'status' => 'received',
                'occurred_at' => now(),
            ]);

            $conversation->increment('message_count');
            $conversation->forceFill(['last_message_at' => now()])->save();
        }

        // Opt-in postbacks (payload convention: OPTIN:<topic>).
        if ($postbackPayload !== null && str_starts_with($postbackPayload, 'OPTIN:')) {
            $eligibility->recordOptIn($contact, substr($postbackPayload, 6) ?: 'general', 'postback');
        }

        // Automation pipeline: welcome (first interaction) then rule matching.
        $engine->handleWelcome($page, $contact);

        $engine->handleInbound(
            $page,
            $contact,
            $isPostback ? 'postback' : 'message',
            $messageText,
            $postbackPayload,
        );
    }

    /**
     * Find-or-create the Messenger contact, enriching permitted profile
     * fields only (no scraping).
     */
    protected function upsertContact(FacebookPage $page, string $psid, array $event): MessengerContact
    {
        $contact = MessengerContact::withTrashed()->firstOrCreate(
            ['facebook_page_id' => $page->id, 'psid' => $psid],
            [
                'user_id' => $page->user_id,
                'source' => isset($this->event['referral']) ? 'dm' : 'dm',
            ],
        );

        $now = now();

        $contact->forceFill([
            'last_interaction_at' => $now,
            'last_user_message_at' => $now, // opens/refreshes the 24h window
            'first_interaction_at' => $contact->first_interaction_at ?? $now,
        ])->save();

        if ($contact->trashed()) {
            $contact->restore();
        }

        return $contact;
    }

    protected function updateBroadcastStats(array $mids, string $status): void
    {
        $events = MessageEvent::whereIn('meta_message_id', $mids)
            ->whereNotNull('broadcast_id')
            ->get(['broadcast_id']);

        foreach ($events->pluck('broadcast_id')->unique() as $broadcastId) {
            $broadcast = \App\Models\Broadcast::find($broadcastId);
            if ($broadcast !== null) {
                app(\App\Services\BroadcastService::class)->recalculateStatistics($broadcast);
            }
        }
    }

    protected function markBroadcastRecipientsRead(FacebookPage $page): void
    {
        // Simplified read rollup: contacts on this page with recent outbound
        // broadcast messages within the last day get their recipients marked.
        \App\Models\BroadcastRecipient::whereHas('broadcast', fn ($q) => $q->where('facebook_page_id', $page->id))
            ->whereIn('status', ['sent', 'delivered'])
            ->where('sent_at', '>=', now()->subDay())
            ->update(['status' => 'read', 'read_at' => now()]);
    }
}
