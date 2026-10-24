<?php

namespace App\Services;

use App\Models\FacebookPage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Official Meta Facebook Login flow: dialog URL, code exchange, page list
 * retrieval, page token derivation and webhook subscription.
 */
class MetaOAuthService
{
    public function __construct(
        private readonly MetaGraphApiService $graph,
        private readonly MetaCredentialGuard $guard,
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Build the official Facebook Login authorization dialog URL with a
     * CSRF state parameter stored in session.
     */
    public function authorizationUrl(): string
    {
        $this->guard->assertLiveOperationsEnabled('oauth.redirect');

        $state = Str::random(40);
        session(['meta_oauth_state' => $state]);

        $params = http_build_query([
            'client_id' => $this->guard->appId(),
            'redirect_uri' => config('meta.redirect_uri'),
            'state' => $state,
            'response_type' => 'code',
            'scope' => implode(',', config('meta.permissions')),
        ]);

        $version = $this->graph->version();

        return "https://www.facebook.com/{$version}/dialog/oauth?{$params}";
    }

    /**
     * Validate OAuth state (CSRF protection for the callback).
     */
    public function validateState(?string $state): bool
    {
        $expected = session('meta_oauth_state');
        session()->forget('meta_oauth_state');

        return is_string($state) && is_string($expected)
            && hash_equals($expected, $state)
            && $state !== '';
    }

    /**
     * Exchange the authorization code for a short-lived user access token.
     */
    public function exchangeCodeForToken(string $code): array
    {
        $response = Http::timeout(30)->acceptJson()
            ->get($this->graph->baseUrl().'/oauth/access_token', [
                'client_id' => $this->guard->appId(),
                'client_secret' => $this->guard->appSecret(),
                'redirect_uri' => config('meta.redirect_uri'),
                'code' => $code,
            ]);

        $json = $response->json() ?? [];

        if ($response->failed() || isset($json['error'])) {
            $this->logger->error('oauth.token_exchange', $json['error']['message'] ?? 'Token exchange failed');

            return ['ok' => false, 'error' => $json['error']['message'] ?? 'Token exchange failed'];
        }

        return ['ok' => true, 'access_token' => (string) ($json['access_token'] ?? '')];
    }

    /**
     * Fetch pages available to the user, including their page access tokens
     * (short-lived; the long-lived page token is derived below).
     */
    public function fetchUserPages(string $userToken): array
    {
        $result = $this->graph->get('me/accounts', $userToken, [
            'fields' => 'id,name,access_token,category,tasks,profile_picture_url',
            'limit' => 100,
        ]);

        if (! $result['ok']) {
            return ['ok' => false, 'error' => $result['error'] ?? 'Failed to list pages', 'pages' => []];
        }

        $pages = $result['data']['data'] ?? [];

        return ['ok' => true, 'pages' => $pages, 'error' => null];
    }

    /**
     * Derive a long-lived (never-expiring in practice) Page access token
     * from a long-lived user token, per Meta documentation.
     */
    public function exchangePageToken(string $pageToken, string $userToken): string
    {
        $result = $this->graph->get($pageToken, $userToken, [
            'fields' => 'access_token',
        ]);

        if ($result['ok'] && isset($result['data']['access_token'])) {
            return (string) $result['data']['access_token'];
        }

        // Fall back to the page token returned by /me/accounts.
        return $pageToken;
    }

    /**
     * Subscribe a Page to the app's Messenger webhooks.
     */
    public function subscribePageToWebhooks(FacebookPage $page): bool
    {
        $result = $this->graph->post(
            "{$page->meta_page_id}/subscribed_apps",
            (string) $page->access_token_encrypted,
            ['subscribed_fields' => implode(',', config('meta.page_webhook_fields'))]
        );

        $success = $result['ok'];

        $page->forceFill([
            'webhook_subscribed' => $success,
            'webhook_subscribed_at' => $success ? now() : $page->webhook_subscribed_at,
            'last_checked_at' => now(),
        ])->save();

        $this->logger->log(
            $success ? 'info' : 'error',
            'meta',
            'webhook.subscribe',
            $success ? "Page {$page->name} subscribed to webhooks" : 'Page webhook subscription failed: '.($result['error'] ?? 'unknown'),
            ['page_id' => $page->meta_page_id],
            $page->user_id,
            $page->id,
        );

        return $success;
    }

    /**
     * Remove the webhook subscription (used on disconnect).
     */
    public function unsubscribePageFromWebhooks(FacebookPage $page): void
    {
        if (! $page->access_token_encrypted) {
            return;
        }

        $this->graph->delete(
            "{$page->meta_page_id}/subscribed_apps",
            (string) $page->access_token_encrypted
        );
    }

    /**
     * Verify a stored page token is still valid; update connection health.
     */
    public function checkPageConnection(FacebookPage $page): FacebookPage
    {
        if (! $page->access_token_encrypted) {
            return $page;
        }

        $debug = $this->graph->debugToken((string) $page->access_token_encrypted);

        if (! $debug['ok']) {
            $page->forceFill([
                'status' => FacebookPage::STATUS_NEEDS_RECONNECT,
                'status_message' => 'Token check failed: '.($debug['error'] ?? 'unknown error'),
                'last_checked_at' => now(),
            ])->save();

            return $page;
        }

        $data = $debug['data']['data'] ?? [];
        $isValid = (bool) ($data['is_valid'] ?? false);
        $scopes = $data['scopes'] ?? [];
        $expiresAt = $data['expires_at'] ?? 0;

        if (! $isValid) {
            $page->forceFill([
                'status' => FacebookPage::STATUS_NEEDS_RECONNECT,
                'status_message' => 'Access token is no longer valid. Please reconnect the Page.',
                'last_checked_at' => now(),
            ])->save();

            return $page;
        }

        // Page tokens issued to the app itself don't expire; flag other cases.
        $message = ($expiresAt > 0 && $expiresAt < now()->addDays(7)->timestamp)
            ? 'Token expires soon — consider reconnecting.'
            : 'Connection healthy.';

        $page->forceFill([
            'status' => FacebookPage::STATUS_CONNECTED,
            'status_message' => $message,
            'granted_permissions' => $scopes ?: $page->granted_permissions,
            'last_checked_at' => now(),
        ])->save();

        return $page;
    }
}
