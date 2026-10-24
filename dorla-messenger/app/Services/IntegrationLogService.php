<?php

namespace App\Services;

use Illuminate\Support\Str;

/**
 * Central integration log writer. All secrets/tokens are scrubbed before
 * persistence, and webhook payloads are summarized — never stored whole.
 */
class IntegrationLogService
{
    private const SECRET_PATTERNS = [
        '/"(access_token|token|app_secret|client_secret|secret|verify_token)"\s*:\s*"[^"]*"/i',
        '/(access_token|app_secret|client_secret|verify_token)=[^&\s]+/i',
        '/EA[A-Za-z0-9]{20,}/', // typical page-token shape
    ];

    public function log(
        string $level,
        string $channel,
        string $operation,
        ?string $message,
        array $context = [],
        ?int $userId = null,
        ?int $pageId = null,
    ): void {
        try {
            \App\Models\IntegrationLog::create([
                'user_id' => $userId,
                'facebook_page_id' => $pageId,
                'channel' => $channel,
                'operation' => $operation,
                'level' => $level,
                'message' => $message !== null ? Str::limit($message, 480) : null,
                'context' => $this->scrub($context) ?: null,
            ]);
        } catch (\Throwable $e) {
            // Logging must never break the request flow.
            report($e);
        }
    }

    public function info(string $operation, ?string $message = null, array $context = [], ?int $userId = null, ?int $pageId = null): void
    {
        $this->log('info', 'meta', $operation, $message, $context, $userId, $pageId);
    }

    public function warning(string $operation, ?string $message = null, array $context = [], ?int $userId = null, ?int $pageId = null): void
    {
        $this->log('warning', 'meta', $operation, $message, $context, $userId, $pageId);
    }

    public function error(string $operation, ?string $message = null, array $context = [], ?int $userId = null, ?int $pageId = null): void
    {
        $this->log('error', 'meta', $operation, $message, $context, $userId, $pageId);
    }

    private function scrub(mixed $value): mixed
    {
        if (is_string($value)) {
            $value = preg_replace(self::SECRET_PATTERNS, '$1=[REDACTED]', $value);
        } elseif (is_array($value)) {
            foreach ($value as $key => $item) {
                if (is_string($key) && preg_match('/token|secret|password|key/i', $key)) {
                    $value[$key] = '[REDACTED]';
                } else {
                    $value[$key] = $this->scrub($item);
                }
            }
        }

        return $value;
    }
}
