<?php

namespace App\Services;

use App\Models\FacebookPage;
use Illuminate\Support\Facades\Log;

/**
 * Guards every live Meta API operation behind credential validation.
 *
 * The platform boots and fully works for non-Facebook features with
 * placeholder credentials. This service is the single source of truth for
 * deciding whether live Graph API calls are permitted.
 */
class MetaCredentialGuard
{
    public function appId(): ?string
    {
        $id = config('meta.app_id');

        return is_string($id) && ! $this->isPlaceholder($id) ? $id : null;
    }

    public function appSecret(): ?string
    {
        $secret = config('meta.app_secret');

        return is_string($secret) && ! $this->isPlaceholder($secret) ? $secret : null;
    }

    public function verifyToken(): ?string
    {
        $token = config('meta.webhook_verify_token');

        return is_string($token) && ! $this->isPlaceholder($token) ? $token : null;
    }

    /**
     * Are live Facebook operations possible right now?
     */
    public function liveOperationsEnabled(): bool
    {
        return $this->appId() !== null
            && $this->appSecret() !== null
            && ! $this->simulationEnabled();
    }

    /**
     * Are we in development simulation mode?
     */
    public function simulationEnabled(): bool
    {
        return (bool) config('dorla.simulation');
    }

    /**
     * Human-readable list of what is missing (for configuration warnings).
     */
    public function missingItems(): array
    {
        $items = [];

        if ($this->appId() === null) {
            $items[] = 'META_APP_ID is missing or still a placeholder';
        }
        if ($this->appSecret() === null) {
            $items[] = 'META_APP_SECRET is missing or still a placeholder';
        }
        if ($this->verifyToken() === null) {
            $items[] = 'META_WEBHOOK_VERIFY_TOKEN is missing or still a placeholder';
        }
        if ($this->simulationEnabled()) {
            $items[] = 'Simulation mode is ON (DORLA_SIMULATION=true) — live sending disabled';
        }

        return $items;
    }

    /**
     * Can this specific Page send messages live?
     */
    public function pageCanSend(FacebookPage $page): bool
    {
        if (! $this->liveOperationsEnabled()) {
            return false;
        }

        return $page->isHealthy();
    }

    /**
     * Throw if live operations are attempted without credentials.
     */
    public function assertLiveOperationsEnabled(string $operation): void
    {
        if (! $this->liveOperationsEnabled()) {
            Log::warning('Blocked live Meta operation with unconfigured credentials.', [
                'operation' => $operation,
            ]);

            throw new \RuntimeException(
                'Live Meta API operations are disabled: '.implode('; ', $this->missingItems()).'. '.
                'Configure real credentials in .env (see docs/META_APP_SETUP.md).'
            );
        }
    }

    private function isPlaceholder(string $value): bool
    {
        return str_contains($value, 'YOUR_') || str_contains($value, 'REPLACE_WITH_') || trim($value) === '';
    }
}
