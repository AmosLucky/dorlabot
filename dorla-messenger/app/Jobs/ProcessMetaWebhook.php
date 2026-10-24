<?php

namespace App\Jobs;

use App\Services\WebhookEventProcessor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Process a verified Meta webhook payload through the event processor.
 * Dispatched by MetaWebhookController after signature verification so the
 * HTTP response to Meta returns immediately.
 */
class ProcessMetaWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [10, 60];

    public function __construct(
        public array $payload,
    ) {}

    public function handle(WebhookEventProcessor $processor): void
    {
        try {
            $result = $processor->process($this->payload);

            Log::info('Meta webhook processed', [
                'accepted' => $result['accepted'],
                'duplicates' => $result['duplicates'],
                'unknown_pages' => $result['unknown_pages'],
            ]);
        } catch (\Throwable $e) {
            // Never log the raw payload (contains personal data).
            Log::error('Meta webhook processing failed', ['error' => $e->getMessage()]);

            throw $e;
        }
    }
}
