<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin, testable wrapper around the Meta Graph API via Laravel HTTP client.
 *
 * All requests are logged (secrets scrubbed) into integration_logs and the
 * application log. TLS certificate verification is never disabled.
 */
class MetaGraphApiService
{
    public function __construct(
        private readonly MetaCredentialGuard $guard,
        private readonly IntegrationLogService $logger,
    ) {}

    public function baseUrl(): string
    {
        return rtrim(config('meta.graph_base_url', 'https://graph.facebook.com'), '/');
    }

    public function version(): string
    {
        return config('meta.graph_api_version', 'v23.0');
    }

    /**
     * GET request against the Graph API using a page/user access token.
     *
     * @return array{ok: bool, data: array, error: ?string, code: ?int}
     */
    public function get(string $path, string $accessToken, array $query = []): array
    {
        return $this->request('get', $path, $accessToken, $query);
    }

    /**
     * POST request against the Graph API.
     */
    public function post(string $path, string $accessToken, array $body = []): array
    {
        return $this->request('post', $path, $accessToken, $body);
    }

    /**
     * DELETE request (e.g. remove webhook subscription).
     */
    public function delete(string $path, string $accessToken, array $body = []): array
    {
        return $this->request('delete', $path, $accessToken, $body);
    }

    /**
     * App-scoped request signed with the application access token.
     * (Used for debug_token and app-level lookups.)
     */
    public function appAccessToken(): ?string
    {
        $id = $this->guard->appId();
        $secret = $this->guard->appSecret();
        if ($id === null || $secret === null) {
            return null;
        }

        return $id.'|'.$secret;
    }

    /**
     * Inspect a token with /debug_token. Returns ['ok'=>bool, 'data'=>..., 'error'=>...].
     */
    public function debugToken(string $token): array
    {
        $appToken = $this->appAccessToken();
        if ($appToken === null) {
            return ['ok' => false, 'data' => [], 'error' => 'Meta credentials not configured'];
        }

        return $this->get('debug_token', $appToken, ['input_token' => $token]);
    }

    private function request(string $method, string $path, string $accessToken, array $payload = []): array
    {
        $url = $this->baseUrl().'/'.$this->version().'/'.ltrim($path, '/');

        try {
            $response = Http::timeout(30)
                ->retry(2, 500, throw: false)
                ->acceptJson()
                ->withToken($accessToken)
                ->{$method}($url, $payload);
        } catch (ConnectionException $e) {
            Log::error('Graph API connection failure', ['path' => $path, 'error' => $e->getMessage()]);

            return ['ok' => false, 'data' => [], 'error' => 'Connection to Graph API failed', 'code' => null];
        }

        $json = $response->json() ?? [];
        $ok = $response->successful() && ! isset($json['error']);

        if (! $ok) {
            $error = $json['error']['message'] ?? 'HTTP '.$response->status().' from Graph API';
            Log::warning('Graph API error', [
                'path' => $path,
                'status' => $response->status(),
                'error' => $json['error']['message'] ?? null,
                'error_code' => $json['error']['code'] ?? null,
                'error_subcode' => $json['error']['error_subcode'] ?? null,
            ]);
        }

        return [
            'ok' => $ok,
            'data' => is_array($json) ? $json : [],
            'error' => $ok ? null : (string) ($json['error']['message'] ?? 'Graph API request failed'),
            'code' => $response->status(),
        ];
    }

    /**
     * Persist an integration log row (secrets are scrubbed by IntegrationLogService).
     */
    protected function log(string $level, string $operation, string $message, array $context = [], ?int $userId = null, ?int $pageId = null): void
    {
        $this->logger->log($level, 'meta', $operation, $message, $context, $userId, $pageId);
    }
}
