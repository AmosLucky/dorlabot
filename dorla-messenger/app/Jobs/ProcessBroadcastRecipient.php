<?php

namespace App\Jobs;

use App\Models\BroadcastRecipient;
use App\Services\BroadcastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Sends one broadcast message to one recipient. Rate limiting is provided
 * by the queue configuration (see docs/DEPLOYMENT.md for per-Page pacing).
 */
class ProcessBroadcastRecipient implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public array $backoff = [30];

    public function __construct(
        public int $recipientId,
    ) {}

    public function handle(BroadcastService $service): void
    {
        $recipient = BroadcastRecipient::find($this->recipientId);

        if ($recipient === null) {
            return;
        }

        try {
            $service->processRecipient($recipient);
        } catch (\Throwable $e) {
            $recipient->forceFill([
                'status' => 'failed',
                'error_message' => \Illuminate\Support\Str::limit($e->getMessage(), 240),
            ])->save();

            Log::error('Broadcast recipient failed', [
                'recipient_id' => $recipient->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
