<?php

namespace App\Http\Controllers;

use App\Models\FacebookPage;
use App\Services\IntegrationLogService;
use App\Services\MetaCredentialGuard;
use App\Services\MetaOAuthService;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * Official Meta Facebook Login flow: redirect, callback, page selection.
 * No passwords are ever collected; no manual token pasting is supported.
 */
class MetaOAuthController extends Controller
{
    public function __construct(
        private readonly MetaOAuthService $oauth,
        private readonly MetaCredentialGuard $guard,
        private readonly TenantContextService $tenant,
        private readonly IntegrationLogService $logger,
    ) {}

    public function redirect(Request $request): RedirectResponse
    {
        try {
            return redirect()->away($this->oauth->authorizationUrl());
        } catch (\RuntimeException $e) {
            return redirect()->route('pages.index')
                ->with('error', $e->getMessage());
        }
    }

    /**
     * OAuth callback: validate state, exchange code, list Pages, and show
     * the selection screen (the actual connection happens per-Page with a
     * POST + CSRF so link-scanning/clickjacking cannot connect silently).
     */
    public function callback(Request $request): View|RedirectResponse
    {
        if ($request->filled('error')) {
            $this->logger->warning('oauth.denied', 'User denied Facebook authorization: '.($request->query('error_description', '')));

            return redirect()->route('pages.index')
                ->with('error', 'Facebook authorization was cancelled or failed: '.(string) $request->query('error_description', 'unknown error'));
        }

        if (! $this->oauth->validateState((string) $request->query('state', ''))) {
            return redirect()->route('pages.index')
                ->with('error', 'Invalid OAuth state. Please start the connection again.');
        }

        try {
            $exchange = $this->oauth->exchangeCodeForToken((string) $request->query('code', ''));
        } catch (\Throwable $e) {
            return redirect()->route('pages.index')
                ->with('error', 'Could not complete Facebook authorization. Please try again.');
        }

        if (! $exchange['ok']) {
            return redirect()->route('pages.index')
                ->with('error', 'Facebook token exchange failed: '.$exchange['error']);
        }

        $pages = $this->oauth->fetchUserPages($exchange['access_token']);

        if (! $pages['ok']) {
            return redirect()->route('pages.index')
                ->with('error', 'Could not list your Facebook Pages: '.$pages['error']);
        }

        // Store the user token briefly (session) for page-token derivation on select.
        $request->session()->put('meta_user_token', $exchange['access_token']);

        $available = collect($pages['pages'])
            ->filter(fn ($p) => in_array('pages_messaging', $p['tasks'] ?? [], true) || empty($p['tasks']))
            ->values();

        if ($available->isEmpty()) {
            return redirect()->route('pages.index')
                ->with('error', 'No Pages with messaging permission were found on this Facebook account. Make sure you have a role on the Page and grant pages_messaging access.');
        }

        return view('pages.select', [
            'available' => $available,
            'connectedPageIds' => auth()->user()->facebookPages()->pluck('meta_page_id')->all(),
        ]);
    }

    /**
     * Connect a selected Page: derive long-lived page token, verify access,
     * subscribe webhooks, persist encrypted credentials.
     */
    public function connectPage(Request $request, string $metaPageId): RedirectResponse
    {
        $request->validate(['selected' => ['required', 'in:'.$metaPageId]]);

        $userToken = $request->session()->pull('meta_user_token');

        if (! is_string($userToken) || $userToken === '') {
            return redirect()->route('meta.redirect');
        }

        try {
            $pages = $this->oauth->fetchUserPages($userToken);
            if (! $pages['ok']) {
                return redirect()->route('pages.index')->with('error', 'Facebook session expired. Please reconnect.');
            }

            $pageData = collect($pages['pages'])->firstWhere('id', $metaPageId);

            if ($pageData === null) {
                return redirect()->route('pages.index')->with('error', 'That Page is no longer available on your Facebook account.');
            }

            // Duplicate protection within the tenant.
            $exists = FacebookPage::where('user_id', $request->user()->id)
                ->where('meta_page_id', $metaPageId)
                ->first();

            if ($exists !== null && $exists->status !== FacebookPage::STATUS_DISABLED) {
                return redirect()->route('pages.index')->with('info', 'This Page is already connected to your account.');
            }

            $pageToken = $this->oauth->exchangePageToken((string) $pageData['access_token'], $userToken);

            $page = DB::transaction(function () use ($request, $pageData, $pageToken, $exists): FacebookPage {
                $attributes = [
                    'name' => (string) $pageData['name'],
                    'profile_image_url' => $pageData['profile_picture_url'] ?? null,
                    'access_token_encrypted' => $pageToken,
                    'granted_permissions' => config('meta.permissions'),
                    'status' => FacebookPage::STATUS_CONNECTED,
                    'status_message' => 'Connected successfully.',
                    'last_checked_at' => now(),
                    'connected_at' => $exists?->connected_at ?? now(),
                ];

                if ($exists !== null) {
                    $exists->forceFill($attributes)->save();

                    return $exists;
                }

                return FacebookPage::create($attributes + [
                    'user_id' => $request->user()->id,
                    'meta_page_id' => (string) $pageData['id'],
                ]);
            });

            $subscribed = $this->oauth->subscribePageToWebhooks($page);

            $message = 'Page "'.$page->name.'" connected successfully!';
            if (! $subscribed) {
                $message .= ' Note: webhook subscription could not be verified yet — automated replies will activate once it completes.';
            }

            $this->logger->info('oauth.page_connected', "Page {$page->name} connected", ['meta_page_id' => $page->meta_page_id], $request->user()->id, $page->id);

            return redirect()->route('pages.index')->with('success', $message);
        } catch (\Throwable $e) {
            $this->logger->error('oauth.connect_failed', $e->getMessage(), [], $request->user()->id);

            return redirect()->route('pages.index')
                ->with('error', 'Connecting the Page failed: '.\Illuminate\Support\Str::limit($e->getMessage(), 160));
        }
    }
}
