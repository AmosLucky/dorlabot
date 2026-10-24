<?php

namespace App\Http\Controllers;

use App\Models\FacebookPage;
use App\Services\MetaCredentialGuard;
use App\Services\MetaOAuthService;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class FacebookPageController extends Controller
{
    public function __construct(
        private readonly TenantContextService $tenant,
        private readonly MetaCredentialGuard $guard,
        private readonly MetaOAuthService $oauth,
    ) {}

    public function index(Request $request): View
    {
        $pages = $request->user()->facebookPages()->withCount('contacts')->orderBy('name')->get();

        return view('pages.index', [
            'pages' => $pages,
            'metaConfigured' => $this->guard->liveOperationsEnabled(),
            'missingItems' => $this->guard->missingItems(),
            'webhookVerifyUrl' => rtrim(config('meta.app_url'), '/').'/webhooks/meta/messenger',
        ]);
    }

    /**
     * Refresh connection health (token check + webhook status).
     */
    public function refresh(Request $request, FacebookPage $facebookPage): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $facebookPage);

        if (! $this->guard->liveOperationsEnabled()) {
            return back()->with('error', 'Meta credentials are not configured, so connection health cannot be checked. See the configuration warning on this page.');
        }

        if (! $facebookPage->access_token_encrypted) {
            return back()->with('error', 'This Page has no stored token. Please reconnect it.');
        }

        $this->oauth->checkPageConnection($facebookPage);

        return back()->with('success', 'Connection check completed for "'.$facebookPage->name.'": '.$facebookPage->fresh()->status_message);
    }

    /**
     * Disconnect a Page: revoke stored token (encrypted at rest), remove
     * webhook subscription, disable automations.
     */
    public function destroy(Request $request, FacebookPage $facebookPage): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $facebookPage);

        $this->oauth->unsubscribePageFromWebhooks($facebookPage);

        $facebookPage->forceFill([
            'access_token_encrypted' => null,
            'status' => FacebookPage::STATUS_DISABLED,
            'status_message' => 'Disconnected by customer. Reconnect to resume automation.',
            'webhook_subscribed' => false,
        ])->save();

        // Disable all automations for safety (no token, no sends).
        $facebookPage->automations()->update(['is_enabled' => false]);

        return redirect()->route('pages.index')
            ->with('success', 'Page "'.$facebookPage->name.'" disconnected. Its token was deleted and automations paused.');
    }

    /**
     * List eligible posts for comment automations (requires live credentials).
     */
    public function posts(Request $request, FacebookPage $facebookPage): \Illuminate\Http\JsonResponse
    {
        $this->tenant->authorizePage($request->user(), $facebookPage);

        if (! $this->guard->liveOperationsEnabled() || ! $facebookPage->access_token_encrypted) {
            return response()->json([
                'ok' => false,
                'error' => 'Live Meta API access is required to list posts. Connect real Meta credentials or use simulation mode.',
                'posts' => [],
            ], 503);
        }

        $result = app(\App\Services\MetaGraphApiService::class)->get(
            "{$facebookPage->meta_page_id}/posts",
            (string) $facebookPage->access_token_encrypted,
            ['fields' => 'id,message,permalink_url,created_time,is_published', 'limit' => 25],
        );

        if (! $result['ok']) {
            return response()->json([
                'ok' => false,
                'error' => $result['error'],
                'posts' => [],
            ], 502);
        }

        $posts = collect($result['data']['data'] ?? [])
            ->filter(fn ($p) => (bool) ($p['is_published'] ?? true))
            ->map(fn ($p) => [
                'id' => $p['id'],
                'text' => \Illuminate\Support\Str::limit((string) ($p['message'] ?? '(media post)'), 90),
                'url' => $p['permalink_url'] ?? null,
                'created' => $p['created_time'] ?? null,
            ])->values();

        return response()->json(['ok' => true, 'posts' => $posts]);
    }
}
