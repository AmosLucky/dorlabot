<?php

namespace App\Http\Controllers;

use App\Services\WebhookEventProcessor;
use App\Services\WebhookVerificationService;
use App\Jobs\ProcessMetaWebhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Meta webhook endpoints:
 *   GET  /webhooks/meta/messenger  — subscription verification handshake
 *   POST /webhooks/meta/messenger  — event delivery (signature-verified)
 *
 * POST responds to Meta immediately; processing happens in the queue so we
 * never exceed Meta's response-time expectations.
 */
class MetaWebhookController extends Controller
{
    public function __construct(
        private readonly WebhookVerificationService $verifier,
        private readonly WebhookEventProcessor $processor,
    ) {}

    public function verify(Request $request): \Illuminate\Http\Response|JsonResponse
    {
        $result = $this->verifier->verifyHandshake($request);

        if (! $result['ok']) {
            Log::warning('Webhook handshake rejected', ['error' => $result['error']]);

            return response('Forbidden', 403);
        }

        return response($result['challenge'] ?? '', 200)
            ->header('Content-Type', 'text/plain');
    }

    public function receive(Request $request): JsonResponse
    {
        // 1. Authenticity: verify X-Hub-Signature-256 against the raw body.
        if (! $this->verifier->verifySignature($request)) {
            Log::warning('Webhook signature verification failed', [
                'ip' => $request->ip(),
            ]);

            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $payload = json_decode($request->getContent(), true);

        if (! is_array($payload)) {
            return response()->json(['error' => 'Malformed payload'], 400);
        }

        // 2. Fast ack + async processing. Failures are retried by the queue.
        ProcessMetaWebhook::dispatch($payload)->onQueue('webhooks');

        return response()->json(['success' => true]);
    }
}
