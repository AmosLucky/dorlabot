<?php

namespace App\Jobs;

use App\Models\Broadcast;
use App\Services\BroadcastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Hourly analytics rollup: recalculates delivery/read/click statistics for
 * recently active campaigns and closes out completed sends.
 */
class AggregateCampaignAnalytics implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(BroadcastService $service): void
    {
        Broadcast::whereIn('status', [Broadcast::STATUS_SENDING, Broadcast::STATUS_QUEUED, Broadcast::STATUS_PAUSED, Broadcast::STATUS_COMPLETED])
            ->where('updated_at', '>=', now()->subDays(7))
            ->chunkById(50, function ($broadcasts) use ($service): void {
                foreach ($broadcasts as $broadcast) {
                    try {
                        $service->recalculateStatistics($broadcast);

                        // Auto-complete sends with no pending recipients left.
                        $pending = $broadcast->recipients()->where('status', 'pending')->count();
                        if ($pending === 0 && in_array($broadcast->status, [Broadcast::STATUS_SENDING, Broadcast::STATUS_QUEUED], true)) {
                            $broadcast->forceFill([
                                'status' => Broadcast::STATUS_COMPLETED,
                                'completed_at' => now(),
                            ])->save();
                        }
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
            });
    }
}
