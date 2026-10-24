<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Verifies Meta webhook request authenticity.
 *
 * - GET verification handshake: hub.verify_token must match configuration.
 * - POST payloads: X-Hub-Signature-256 must equal HMAC-SHA256 of the RAW
 *   request body using the app secret, compared in constant time.
 */
class WebhookVerificationService
{
    public function __construct(
        private readonly MetaCredentialGuard $guard,
    ) {}

    /**
     * Handle Meta's GET subscription verification handshake.
     *
     * @return array{ok: bool, challenge: ?string, error: ?string}
     */
    public function verifyHandshake(Request $request): array
    {
        $mode = (string) $request->query('hub_mode', '');
        $token = (string) $request->query('hub_verify_token', '');
        $challenge = $request->query('hub_challenge');

        if ($mode !== 'subscribe') {
            return ['ok' => false, 'challenge' => null, 'error' => 'hub_mode must be "subscribe"'];
        }

        $expected = $this->guard->verifyToken();

        if ($expected === null) {
            return ['ok' => false, 'challenge' => null, 'error' => 'Webhook verify token is not configured'];
        }

        if (! hash_equals($expected, $token)) {
            return ['ok' => false, 'challenge' => null, 'error' => 'Invalid hub_verify_token'];
        }

        return ['ok' => true, 'challenge' => is_scalar($challenge) ? (string) $challenge : null, 'error' => null];
    }

    /**
     * Validate the X-Hub-Signature-256 header against the raw body.
     */
    public function verifySignature(Request $request): bool
    {
        $secret = $this->guard->appSecret();

        if ($secret === null) {
            // Without a configured secret we cannot prove authenticity.
            return false;
        }

        $header = (string) $request->header('X-Hub-Signature-256', '');

        if (! str_starts_with($header, 'sha256=')) {
            return false;
        }

        $rawBody = $request->getContent();
        $expectedHash = 'sha256='.hash_hmac('sha256', $rawBody, $secret);

        return hash_equals($expectedHash, $header);
    }

    /**
     * Build the idempotency key for a webhook entry (stable across duplicate
     * deliveries of the same event).
     */
    public function eventKey(array $payload): string
    {
        $parts = [];

        $object = $payload['object'] ?? '';
        $parts[] = is_string($object) ? $object : '';

        foreach (($payload['entry'] ?? []) as $entry) {
            $parts[] = (string) ($entry['id'] ?? '');
            $parts[] = (string) ($entry['time'] ?? '');

            foreach (['messaging', 'changes', 'standby'] as $collection) {
                foreach (($entry[$collection] ?? []) as $event) {
                    // Prefer provider-supplied stable identifiers when present.
                    foreach (['mid', 'message_id', 'comment_id', 'post_id', 'id', 'value'] as $key) {
                        if (isset($event[$key]) && is_scalar($event[$key])) {
                            $parts[] = (string) $event[$key];
                        } elseif ($key === 'value' && is_array($event[$key] ?? null)) {
                            foreach (['mid', 'comment_id', 'post_id', 'from'] as $vk) {
                                if (isset($event['value'][$vk]) && is_scalar($event['value'][$vk])) {
                                    $parts[] = (string) $event['value'][$vk];
                                }
                            }
                        }
                    }

                    $parts[] = (string) json_encode($this->stableSubset($event));
                }
            }
        }

        return hash('sha256', implode('|', $parts));
    }

    /**
     * Minimal, PII-safe subset used for the idempotency hash.
     */
    private function stableSubset(array $event): array
    {
        return [
            'f' => $event['field'] ?? null,
            'm' => $event['message']['mid'] ?? $event['mid'] ?? null,
            'p' => $event['post_id'] ?? null,
            'c' => $event['comment_id'] ?? null,
            't' => $event['timestamp'] ?? $event['time'] ?? null,
        ];
    }
}
