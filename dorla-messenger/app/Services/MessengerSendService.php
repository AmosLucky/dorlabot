<?php

namespace App\Services;

use App\Models\FacebookPage;
use App\Models\MessageEvent;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Messenger Send API wrapper. Every outbound path in the platform goes
 * through this service so eligibility checks, simulation labeling, error
 * capture and analytics rows are applied consistently.
 *
 * Simulation mode: when DORLA_SIMULATION=true (dev only) messages are NOT
 * sent to Meta; they are persisted with is_simulated=true and are rendered
 * with a visible "Simulated" badge everywhere in the UI.
 */
class MessengerSendService
{
    public function __construct(
        private readonly MetaGraphApiService $graph,
        private readonly MetaCredentialGuard $guard,
        private readonly MessagingEligibilityService $eligibility,
        private readonly MessageTemplateService $templates,
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Send a message payload to a PSID. Persists a MessageEvent row.
     *
     * @param  array{text?: string, buttons?: array, quick_replies?: array}  $payload
     * @param  string|null  $messageTag  Optional permitted tag (ACCOUNT_UPDATE etc.)
     * @return array{ok: bool, message_event: MessageEvent, error: ?string, simulated: bool}
     */
    public function send(
        FacebookPage $page,
        string $recipientPsid,
        array $payload,
        ?\App\Models\MessengerContact $contact = null,
        ?string $messageTag = null,
        ?\App\Models\Broadcast $broadcast = null,
        ?\App\Models\AutomationExecution $execution = null,
        ?\App\Models\Conversation $conversation = null,
    ): array {
        $simulated = ! $this->guard->liveOperationsEnabled();

        $message = $this->buildMessageBody($payload, $messageTag);

        if ($simulated) {
            $event = $this->persistMessageEvent(
                $page, $contact, $conversation, $broadcast, $execution,
                $recipientPsid, $payload, $messageTag,
                MessageEvent::STATUS_SENT, null, null, simulated: true,
            );

            $this->logger->info(
                'send.simulated',
                "SIMULATED message (never sent to Meta) to {$recipientPsid} on page {$page->name}",
                ['text' => Str::of($payload['text'] ?? '')->limit(120)->toString()],
                $page->user_id, $page->id,
            );

            return ['ok' => true, 'message_event' => $event, 'error' => null, 'simulated' => true];
        }

        $body = [
            'recipient' => ['id' => $recipientPsid],
            'message' => $message,
            'messaging_type' => $messageTag !== null ? 'MESSAGE_TAG' : 'RESPONSE',
        ];

        if ($messageTag !== null) {
            $body['tag'] = $messageTag;
        }

        $result = $this->graph->post('me/messages', (string) $page->access_token_encrypted, $body);

        $metaMessageId = $result['data']['message_id'] ?? null;
        $recipientId = $result['data']['recipient_id'] ?? null;

        $event = $this->persistMessageEvent(
            $page, $contact, $conversation, $broadcast, $execution,
            $recipientPsid, $payload, $messageTag,
            $result['ok'] ? MessageEvent::STATUS_SENT : MessageEvent::STATUS_FAILED,
            $metaMessageId,
            $result['ok'] ? null : ($result['error'] ?? 'Send failed'),
            simulated: false,
        );

        if (! $result['ok']) {
            $this->logger->error('send.failed', $result['error'] ?? 'Send API failure', [
                'page' => $page->meta_page_id,
                'recipient' => $recipientPsid,
            ], $page->user_id, $page->id);
        }

        return [
            'ok' => $result['ok'],
            'message_event' => $event,
            'error' => $result['ok'] ? null : $result['error'],
            'simulated' => false,
        ];
    }

    /**
     * Mark a message as read (sender action), used after webhook read events
     * are processed — helper kept explicit for tests.
     */
    public function markSeen(FacebookPage $page, string $recipientPsid): bool
    {
        if (! $this->guard->liveOperationsEnabled()) {
            return true; // simulated environments treat as success
        }

        $result = $this->graph->post('me/messages', (string) $page->access_token_encrypted, [
            'recipient' => ['id' => $recipientPsid],
            'sender_action' => 'mark_seen',
        ]);

        return $result['ok'];
    }

    /**
     * Send a private reply to a comment via the comment's private_reply endpoint.
     */
    public function sendPrivateReply(
        FacebookPage $page,
        string $commentId,
        string $text,
        ?\App\Models\AutomationExecution $execution = null,
    ): array {
        $simulated = ! $this->guard->liveOperationsEnabled();

        if ($simulated) {
            $event = $this->persistMessageEvent(
                $page, null, null, null, $execution,
                'comment:'.$commentId,
                ['text' => $text], null,
                MessageEvent::STATUS_SENT, null, null, simulated: true,
            );

            return ['ok' => true, 'message_event' => $event, 'error' => null, 'simulated' => true];
        }

        $result = $this->graph->post(
            "{$commentId}/private_replies",
            (string) $page->access_token_encrypted,
            ['message' => $text],
        );

        $metaMessageId = $result['data']['message_id'] ?? null;

        $event = $this->persistMessageEvent(
            $page, null, null, null, $execution,
            'comment:'.$commentId, ['text' => $text], null,
            $result['ok'] ? MessageEvent::STATUS_SENT : MessageEvent::STATUS_FAILED,
            $metaMessageId,
            $result['ok'] ? null : $result['error'],
            simulated: false,
        );

        return [
            'ok' => $result['ok'],
            'message_event' => $event,
            'error' => $result['ok'] ? null : $result['error'],
            'simulated' => false,
        ];
    }

    private function buildMessageBody(array $payload, ?string $messageTag): array
    {
        if (! empty($payload['quick_replies']) && isset($payload['text'])) {
            $message = ['text' => $payload['text'], 'quick_replies' => $payload['quick_replies']];
        } elseif (! empty($payload['buttons']) && isset($payload['text'])) {
            $message = [
                'attachment' => [
                    'type' => 'template',
                    'payload' => [
                        'template_type' => 'button',
                        'text' => $payload['text'],
                        'buttons' => $payload['buttons'],
                    ],
                ],
            ];
        } else {
            $message = ['text' => $payload['text'] ?? ''];
        }

        return $message;
    }

    private function persistMessageEvent(
        FacebookPage $page,
        ?\App\Models\MessengerContact $contact,
        ?\App\Models\Conversation $conversation,
        ?\App\Models\Broadcast $broadcast,
        ?\App\Models\AutomationExecution $execution,
        string $recipientPsid,
        array $payload,
        ?string $messageTag,
        string $status,
        ?string $metaMessageId,
        ?string $error,
        bool $simulated,
    ): MessageEvent {
        return MessageEvent::create([
            'user_id' => $page->user_id,
            'facebook_page_id' => $page->id,
            'messenger_contact_id' => $contact?->id,
            'conversation_id' => $conversation?->id,
            'broadcast_id' => $broadcast?->id,
            'automation_execution_id' => $execution?->id,
            'direction' => MessageEvent::DIRECTION_OUT,
            'meta_message_id' => $metaMessageId,
            'recipient_psid' => $recipientPsid,
            'message_text' => $payload['text'] ?? null,
            'message_payload' => $payload,
            'message_type' => isset($payload['buttons']) ? 'button' : (isset($payload['quick_replies']) ? 'text' : 'text'),
            'status' => $status,
            'error_message' => $error,
            'is_simulated' => $simulated,
            'occurred_at' => now(),
        ]);
    }
}
