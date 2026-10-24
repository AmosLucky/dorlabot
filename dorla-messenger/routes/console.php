<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Scheduled jobs (Laravel Scheduler — one cron entry on the host:
| * * * * * cd /path && php artisan schedule:run >> /dev/null 2>&1)
|--------------------------------------------------------------------------
*/

// Verify each connected Page's token health every 6 hours and flip unhealthy
// connections to needs_reconnect so customers see an actionable warning.
Schedule::job(new \App\Jobs\RefreshPageConnectionStatus)
    ->everySixHours()
    ->name('refresh-page-connections');

// Queue due scheduled broadcasts. Runs every minute; MessagingEligibility
// and Meta policy checks are applied per-recipient at send time.
Schedule::call(function (): void {
    \App\Services\BroadcastService::queueDueScheduled();
})->everyMinute()->name('queue-scheduled-broadcasts');

// Aggregate per-campaign analytics (delivery/read/click rollups).
Schedule::job(new \App\Jobs\AggregateCampaignAnalytics)
    ->hourly()
    ->name('aggregate-campaign-analytics');

// Process approved data deletion requests daily (privacy compliance).
Schedule::call(function (): void {
    \App\Services\DataDeletionService::processApprovedRequests();
})->dailyAt('03:00')->name('process-data-deletions');

// Prune stale webhook event idempotency records (keep 30 days for dedup).
Schedule::command('model:prune')->daily();

// Clean up old cache/queue tables occasionally.
Schedule::command('queue:prune-failed --hours=168')->weekly();
