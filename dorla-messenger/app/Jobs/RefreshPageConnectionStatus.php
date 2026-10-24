<?php

namespace App\Jobs;

use App\Models\FacebookPage;
use App\Services\MetaOAuthService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Periodic connection health check: verifies every connected Page's token
 * and flips unhealthy connections to needs_reconnect so customers get an
 * actionable warning instead of silent send failures.
 */
class RefreshPageConnectionStatus implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(MetaOAuthService $oauth): void
    {
        FacebookPage::whereIn('status', [FacebookPage::STATUS_CONNECTED, FacebookPage::STATUS_NEEDS_RECONNECT])
            ->whereNotNull('access_token_encrypted')
            ->chunkById(50, function ($pages) use ($oauth): void {
                foreach ($pages as $page) {
                    try {
                        $oauth->checkPageConnection($page);
                    } catch (\Throwable $e) {
                        // Individual page failures must not stop the batch.
                        report($e);
                    }
                }
            });
    }
}
