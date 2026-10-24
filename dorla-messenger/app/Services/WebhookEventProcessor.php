<?php

namespace App\Services;

use App\Jobs\ProcessCommentEvent;
use App\Jobs\ProcessIncomingMessage;
use App\Models\FacebookPage;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Log;

/**
 * Parses verified webhook payloads, resolves the tenant through the
 * connected Page record, deduplicates events and dispatches queue jobs.
 *
 * Design rules:
 *  - No secrets or personal data are logged; summaries only.
 *  - Response to Meta is always fast; work happens in queued jobs.
 */
class WebhookEventProcessor
{
    public function __construct(
        private readonly WebhookVerificationService $verifier,
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Process a verified POST payload.
     *
     * @return array{accepted: int, duplicates: int, unknown_pages: int}
     */
    public function process(array $payload): array
    {
        $accepted = 0;
        $duplicates = 0;
        $unknownPages = 0;

        $object = $payload['object'] ?? null;

        foreach (($payload['entry'] ?? []) as $entry) {
            $pageMetaId = (string) ($entry['id'] ?? '');
            $page = FacebookPage::where('meta_page_id', $pageMetaId)->first();

            if ($page === null) {
                $unknownPages++;
                $this->logger->warning('webhook.unknown_page', "Webhook entry for unknown Page {$pageMetaId}");
                continue;
            }

            // messaging / messaging_postbacks / message_deliveries / message_reads / standby
            foreach (['messaging', 'standby'] as $collection) {
                foreach (($entry[$collection] ?? []) as $event) {
                    $handled = $this->handleMessagingEvent($payload, $event, $page, $collection);
                    $handled === 'duplicate' ? $duplicates++ : $accepted++;
                }
            }

            // feed changes (comments)
            foreach (($entry['changes'] ?? []) as $change) {
                if (($change['field'] ?? '') !== 'feed') {
                    continue;
                }

                $handled = $this->handleFeedChange($payload, $change, $page);
                $handled === 'duplicate' ? $duplicates++ : $accepted++;
            }
        }

        return ['accepted' => $accepted, 'duplicates' => $duplicates, 'unknown_pages' => $unknownPages];
    }

    private function handleMessagingEvent(array $payload, array $event, FacebookPage $page, string $collection): string
    {
        $eventKey = $this->verifier->eventKey([
            'object' => $payload['object'] ?? '',
            'entry' => [
                [
                    'id' => $page->meta_page_id,
                    'time' => $entry['timestamp'] ?? null,
                    'messaging' => [$event],
                ],
            ],
        ]);

        $webhookEvent = WebhookEvent::firstOrCreate(
            ['event_key' => $eventKey],
            [
                'object' => $payload['object'] ?? 'page',
                'field' => $collection,
                'facebook_page_id' => $page->id,
                'status' => WebhookEvent::STATUS_RECEIVED,
                'summary' => $this->summarize($event),
                'received_at' => now(),
            ],
        );

        // Idempotency: event already recorded -> treat as duplicate delivery.
        if (! $webhookEvent->wasRecentlyCreated) {
            $webhookEvent->forceFill(['status' => WebhookEvent::STATUS_DUPLICATED])->save();

            return 'duplicate';
        }

        $webhookEvent->forceFill(['status' => WebhookEvent::STATUS_PROCESSED])->save();

        // Queue async processing (skip read/delivery echo events with no action).
        ProcessIncomingMessage::dispatch($page->id, $event, $collection === 'standby')
            ->onQueue('messaging');

        return 'accepted';
    }

    private function handleFeedChange(array $payload, array $change, FacebookPage $page): string
    {
        $value = $change['value'] ?? [];
        $item = $value['item'] ?? '';
        $verb = $value['verb'] ?? '';

        // Only comment additions are actionable for private replies.
        if ($item !== 'comment' || $verb !== 'add') {
            return 'accepted'; // acknowledged, no-op
        }

        $eventKey = $this->verifier->eventKey([
            'object' => $payload['object'] ?? '',
            'entry' => [
                [
                    'id' => $page->meta_page_id,
                    'time' => $value['created_time'] ?? null,
                    'changes' => [$change],
                ],
            ],
        ]);

        $webhookEvent = WebhookEvent::firstOrCreate(
            ['event_key' => $eventKey],
            [
                'object' => $payload['object'] ?? 'page',
                'field' => 'feed',
                'facebook_page_id' => $page->id,
                'status' => WebhookEvent::STATUS_RECEIVED,
                'summary' => $this->summarizeComment($value),
                'received_at' => now(),
            ],
        );

        if (! $webhookEvent->wasRecentlyCreated) {
            $webhookEvent->forceFill(['status' => WebhookEvent::STATUS_DUPLICATED])->save();

            return 'duplicate';
        }

        $webhookEvent->forceFill(['status' => WebhookEvent::STATUS_PROCESSED])->save();

        ProcessCommentEvent::dispatch($page->id, $value)->onQueue('comments');

        return 'accepted';
    }

    /**
     * PII-safe summary for the webhook_events ledger.
     */
    private function summarize(array $event): array
    {
        $summary = ['type' => 'messaging'];

        if (isset($event['message']['mid'])) {
            $summary['message_id'] = $event['message']['mid'];
            $summary['kind'] = 'message';
        } elseif (isset($event['postback'])) {
            $summary['kind'] = 'postback';
            $summary['payload'] = substr((string) ($event['postback']['payload'] ?? ''), 0, 100);
        } elseif (isset($event['delivery'])) {
            $summary['kind'] = 'delivery';
            $summary['mids'] = array_slice($event['delivery']['mids'] ?? [], 0, 5);
        } elseif (isset($event['read'])) {
            $summary['kind'] = 'read';
        } elseif (isset($event['optin'])) {
            $summary['kind'] = 'optin';
        } elseif (isset($event['referral'])) {
            $summary['kind'] = 'referral';
        }

        $summary['sender_hash'] = isset($event['sender']['id'])
            ? substr(hash('sha256', (string) $event['sender']['id']), 0, 12)
            : null;

        return $summary;
    }

    private function summarizeComment(array $value): array
    {
        return [
            'type' => 'feed_comment',
            'item' => $value['item'] ?? null,
            'verb' => $value['verb'] ?? null,
            'comment_id' => substr((string) ($value['comment_id'] ?? ''), 0, 64),
            'post_id' => substr((string) ($value['post_id'] ?? ''), 0, 64),
            'from_hash' => isset($value['from']['id'])
                ? substr(hash('sha256', (string) $value['from']['id']), 0, 12)
                : null,
        ];
    }
}
