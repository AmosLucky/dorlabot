<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FacebookPage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AdminPageController extends Controller
{
    public function index(Request $request): View
    {
        $pages = FacebookPage::query()
            ->with(['user:id,name,email'])
            ->withCount('contacts')
            ->when($request->filled('q'), function ($q) use ($request): void {
                $term = (string) $request->input('q');
                $q->where(fn ($w) => $w->where('name', 'like', "%{$term}%")
                    ->orWhere('meta_page_id', 'like', "%{$term}%"));
            })
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->orderByDesc('id')
            ->paginate(20)->withQueryString();

        // Tokens are NEVER rendered — only health metadata.
        return view('admin.pages.index', [
            'pages' => $pages,
            'statuses' => [
                FacebookPage::STATUS_CONNECTED => 'Connected',
                FacebookPage::STATUS_NEEDS_RECONNECT => 'Needs reconnect',
                FacebookPage::STATUS_DISABLED => 'Disabled',
            ],
        ]);
    }

    /**
     * Disable a connection (token deleted, automations stopped).
     */
    public function toggle(Request $request, FacebookPage $facebookPage): RedirectResponse
    {
        if ($facebookPage->status === FacebookPage::STATUS_DISABLED) {
            $facebookPage->forceFill([
                'status' => FacebookPage::STATUS_NEEDS_RECONNECT,
                'status_message' => 'Re-enabled by platform admin — customer must reconnect.',
            ])->save();

            $action = 'page.reenabled';
            $message = 'Page connection re-enabled (customer must reconnect to resume).';
        } else {
            $facebookPage->forceFill([
                'access_token_encrypted' => null,
                'status' => FacebookPage::STATUS_DISABLED,
                'status_message' => 'Disabled by platform administration.',
                'webhook_subscribed' => false,
            ])->save();

            $facebookPage->automations()->update(['is_enabled' => false]);
            $action = 'page.disabled';
            $message = 'Page disabled and token revoked. Automations paused.';
        }

        AuditLog::record($action, targetId: $facebookPage->user_id, subjectType: FacebookPage::class, subjectId: $facebookPage->id);

        return back()->with('success', $message);
    }
}
