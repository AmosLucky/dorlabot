<?php

namespace App\Http\Controllers;

use App\Models\AutomationRule;
use App\Models\CommentEvent;
use App\Models\FacebookPage;
use App\Services\MessageTemplateService;
use App\Services\MetaCredentialGuard;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Comment-to-Messenger automations: private replies to Page post comments.
 */
class CommentAutomationController extends Controller
{
    public function __construct(
        private readonly TenantContextService $tenant,
        private readonly MetaCredentialGuard $guard,
        private readonly MessageTemplateService $templates,
    ) {}

    public function index(Request $request): View
    {
        $rules = AutomationRule::where('user_id', $request->user()->id)
            ->where('type', AutomationRule::TYPE_COMMENT_REPLY)
            ->with(['page'])
            ->withCount(['commentEvents'])
            ->orderByDesc('id')
            ->paginate(15);

        $pageIds = $request->user()->facebookPages()->pluck('id');

        $stats = [
            'processed' => CommentEvent::whereIn('facebook_page_id', $pageIds)->where('status', 'processed')->count(),
            'skipped' => CommentEvent::whereIn('facebook_page_id', $pageIds)->where('status', 'skipped')->count(),
            'duplicates' => CommentEvent::whereIn('facebook_page_id', $pageIds)->where('status', 'duplicate')->count(),
            'failed' => CommentEvent::whereIn('facebook_page_id', $pageIds)->where('status', 'failed')->count(),
        ];

        $recentEvents = CommentEvent::whereIn('facebook_page_id', $pageIds)
            ->orderByDesc('id')->limit(15)->get();

        return view('comment-automations.index', [
            'rules' => $rules,
            'stats' => $stats,
            'recentEvents' => $recentEvents,
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function create(Request $request): View
    {
        return view('comment-automations.create', [
            'pages' => $request->user()->facebookPages()->where('status', FacebookPage::STATUS_CONNECTED)->orderBy('name')->get(['id', 'name', 'status']),
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateCommentRule($request);

        $page = FacebookPage::where('user_id', $request->user()->id)->findOrFail($validated['facebook_page_id']);

        $validated['type'] = AutomationRule::TYPE_COMMENT_REPLY;
        $validated['is_enabled'] = $request->boolean('publish');

        $rule = AutomationRule::create($validated + ['user_id' => $request->user()->id]);

        return redirect()->route('comment-automations.index')
            ->with('success', 'Comment automation "'.$rule->name.'" saved'.($rule->is_enabled ? ' and published' : ' as draft').'.');
    }

    public function edit(Request $request, AutomationRule $automationRule): View
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        return view('comment-automations.edit', [
            'rule' => $automationRule,
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function update(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $validated = $this->validateCommentRule($request, $automationRule);
        $validated['is_enabled'] = $request->boolean('publish');

        $automationRule->update($validated);

        return redirect()->route('comment-automations.index')
            ->with('success', 'Comment automation updated.');
    }

    public function destroy(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $automationRule->delete();

        return redirect()->route('comment-automations.index')->with('success', 'Comment automation deleted.');
    }

    public function toggle(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $automationRule->update(['is_enabled' => ! $automationRule->is_enabled]);

        return back()->with('success', 'Comment automation '.($automationRule->is_enabled ? 'enabled' : 'paused').'.');
    }

    protected function validateCommentRule(Request $request, ?AutomationRule $existing = null): array
    {
        $validated = $request->validate([
            'facebook_page_id' => ['required', 'integer', 'exists:facebook_pages,id'],
            'name' => ['required', 'string', 'max:150'],
            'meta_post_id' => ['nullable', 'string', 'max:128', 'regex:/^[0-9_]+$/'],
            'post_url' => ['nullable', 'url', 'max:500'],
            'match_type' => ['required', 'in:contains,exact,starts_with,any'],
            'keywords' => ['nullable', 'string', 'max:2000'],
            'message_text' => ['required', 'string', 'max:1900'],
            'fallback_text' => ['nullable', 'string', 'max:1900'],
        ]);

        foreach (['message_text', 'fallback_text'] as $field) {
            if (! empty($validated[$field])) {
                $errors = $this->templates->validate($validated[$field]);
                if ($errors !== []) {
                    throw \Illuminate\Validation\ValidationException::withMessages([$field => $errors]);
                }
            }
        }

        $validated['keywords'] = collect(explode(',', (string) ($validated['keywords'] ?? '')))
            ->map(fn ($k) => trim($k))->filter()->unique()->values()->all();

        if ($validated['match_type'] !== 'any' && empty($validated['keywords'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'keywords' => ['Add keywords or choose "Reply to every comment".'],
            ]);
        }

        return $validated;
    }
}
