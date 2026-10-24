<?php

namespace App\Http\Controllers;

use App\Models\AutomationRule;
use App\Models\FacebookPage;
use App\Services\MessageTemplateService;
use App\Services\MessagingEligibilityService;
use App\Services\MessengerContactService;
use App\Services\MetaCredentialGuard;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

/**
 * Welcome / default reply / keyword automations.
 */
class AutomationController extends Controller
{
    public function __construct(
        private readonly TenantContextService $tenant,
        private readonly MetaCredentialGuard $guard,
        private readonly MessageTemplateService $templates,
    ) {}

    public function index(Request $request): View
    {
        $rules = AutomationRule::where('user_id', $request->user()->id)
            ->whereIn('type', [AutomationRule::TYPE_WELCOME, AutomationRule::TYPE_DEFAULT_REPLY, AutomationRule::TYPE_KEYWORD])
            ->with('page')
            ->orderBy('type')->orderBy('priority')->orderBy('name')
            ->paginate(15);

        return view('automations.index', [
            'rules' => $rules,
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function create(Request $request): View
    {
        $type = (string) $request->query('type', AutomationRule::TYPE_KEYWORD);

        return view('automations.create', [
            'type' => in_array($type, [AutomationRule::TYPE_WELCOME, AutomationRule::TYPE_DEFAULT_REPLY, AutomationRule::TYPE_KEYWORD], true)
                ? $type : AutomationRule::TYPE_KEYWORD,
            'pages' => $this->activePages($request),
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateRule($request);

        $page = $this->ownedPage($request, (int) $validated['facebook_page_id']);

        // Only ONE welcome + ONE default reply per page: upsert semantics.
        if (in_array($validated['type'], [AutomationRule::TYPE_WELCOME, AutomationRule::TYPE_DEFAULT_REPLY], true)) {
            $existing = AutomationRule::where('facebook_page_id', $page->id)
                ->where('type', $validated['type'])->first();

            if ($existing !== null) {
                return redirect()->route('automations.edit', $existing)
                    ->with('info', 'This Page already has a '.$validated['type'].' automation — you can edit it here.');
            }
        }

        $rule = DB::transaction(function () use ($request, $validated, $page): AutomationRule {
            $rule = AutomationRule::create($validated + [
                'user_id' => $request->user()->id,
                'is_enabled' => $request->boolean('publish') && $this->guard->liveOperationsEnabled() || $request->boolean('publish') && $this->guard->simulationEnabled(),
                'published_at' => $request->boolean('publish') ? now() : null,
            ]);

            return $rule;
        });

        return redirect()->route('automations.index')
            ->with('success', 'Automation "'.$rule->name.'" saved'.($rule->is_enabled ? ' and published' : ' as draft').'.');
    }

    public function edit(Request $request, AutomationRule $automationRule): View
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        return view('automations.edit', [
            'rule' => $automationRule,
            'pages' => $this->activePages($request),
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    public function update(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $validated = $this->validateRule($request, $automationRule);
        $validated['is_enabled'] = $request->boolean('publish');
        $validated['published_at'] = $request->boolean('publish') ? ($automationRule->published_at ?? now()) : null;

        $automationRule->update($validated);

        return redirect()->route('automations.index')
            ->with('success', 'Automation "'.$automationRule->name.'" updated.');
    }

    public function destroy(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $name = $automationRule->name;
        $automationRule->delete();

        return redirect()->route('automations.index')->with('success', 'Automation "'.$name.'" deleted.');
    }

    public function toggle(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $automationRule->update([
            'is_enabled' => ! $automationRule->is_enabled,
            'published_at' => ! $automationRule->is_enabled ? now() : $automationRule->published_at,
        ]);

        return back()->with('success', 'Automation "'.($automationRule->is_enabled ? 'enabled' : 'paused').'" — status updated.');
    }

    /**
     * Live test: send the rendered message to a chosen test recipient PSID
     * (or simulate it when credentials are absent).
     */
    public function test(Request $request, AutomationRule $automationRule): RedirectResponse
    {
        $this->tenant->authorizePage($request->user(), $automationRule->page);

        $request->validate(['test_psid' => ['required', 'string', 'max:120']]);

        $rendered = $this->templates->render(
            $automationRule->message_text ?? '',
            null,
            $automationRule->page,
        );

        $live = $this->guard->liveOperationsEnabled() && $automationRule->page->isHealthy();

        if ($live) {
            $contact = \App\Models\MessengerContact::where('facebook_page_id', $automationRule->facebook_page_id)
                ->where('psid', $request->input('test_psid'))->first();

            $result = app(\App\Services\MessengerSendService::class)->send(
                $automationRule->page,
                (string) $request->input('test_psid'),
                $automationRule->sendPayload($rendered),
                $contact,
            );

            if (! $result['ok']) {
                return back()->with('error', 'Test send failed: '.$result['error']);
            }

            return back()->with('success', 'Test message sent! Check the recipient\'s Messenger.');
        }

        return back()->with('info', 'SIMULATED test (live sending disabled). Rendered message: "'.$rendered.'"');
    }

    /*
    |--------------------------------------------------------------------------
    | Validation + helpers
    |--------------------------------------------------------------------------
    */

    protected function validateRule(Request $request, ?AutomationRule $existing = null): array
    {
        $validated = $request->validate([
            'type' => ['required', 'in:welcome,default_reply,keyword'],
            'facebook_page_id' => ['required', 'integer', 'exists:facebook_pages,id'],
            'name' => ['required', 'string', 'max:150'],
            'match_type' => ['nullable', 'in:contains,exact,starts_with,any'],
            'keywords' => ['nullable', 'string', 'max:2000'],
            'message_text' => ['required', 'string', 'max:1900'],
            'fallback_text' => ['nullable', 'string', 'max:1900'],
            'follow_up_text' => ['nullable', 'string', 'max:1900'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'buttons' => ['nullable', 'array', 'max:3'],
            'buttons.*.type' => ['required_with:buttons', 'in:web_url,postback'],
            'buttons.*.title' => ['required_with:buttons', 'string', 'max:20'],
            'buttons.*.url' => ['nullable', 'url', 'max:500'],
            'buttons.*.payload' => ['nullable', 'string', 'max:120'],
            'quick_replies' => ['nullable', 'array', 'max:11'],
            'quick_replies.*.title' => ['required_with:quick_replies', 'string', 'max:20'],
            'business_hours_enabled' => ['nullable', 'boolean'],
            'business_hours_start' => ['nullable', 'date_format:H:i'],
            'business_hours_end' => ['nullable', 'date_format:H:i'],
            'business_hours_timezone' => ['nullable', 'timezone', 'max:64'],
            'after_hours_text' => ['nullable', 'string', 'max:1900'],
            'handoff_enabled' => ['nullable', 'boolean'],
            'handoff_text' => ['nullable', 'string', 'max:1900'],
        ]);

        // Template variable validation — unknown variables are rejected.
        foreach (['message_text', 'fallback_text', 'after_hours_text'] as $field) {
            if (! empty($validated[$field])) {
                $errors = $this->templates->validate($validated[$field]);
                if ($errors !== []) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        $field => $errors,
                    ]);
                }
            }
        }

        $validated['keywords'] = collect(explode(',', (string) ($validated['keywords'] ?? '')))
            ->map(fn ($k) => trim($k))->filter()->unique()->values()->all();

        if ($validated['type'] === AutomationRule::TYPE_KEYWORD && empty($validated['keywords'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'keywords' => ['Keyword rules require at least one keyword.'],
            ]);
        }

        // Business-hours consistency.
        if ($request->boolean('business_hours_enabled')) {
            $validated['business_hours_enabled'] = true;
            if (empty($validated['business_hours_start']) || empty($validated['business_hours_end'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'business_hours_start' => ['Business hours require a start and end time.'],
                ]);
            }
        } else {
            $validated['business_hours_enabled'] = false;
        }

        $validated['handoff_enabled'] = $request->boolean('handoff_enabled');
        $validated['priority'] = (int) ($validated['priority'] ?? 100);

        // Clean buttons (drop empty rows).
        $validated['buttons'] = collect($validated['buttons'] ?? [])
            ->filter(fn ($b) => ! empty($b['title']))
            ->map(function ($b) {
                if (($b['type'] ?? 'web_url') === 'web_url') {
                    unset($b['payload']);
                } else {
                    $b['payload'] = $b['payload'] ?? $b['title'];
                    unset($b['url']);
                }

                return $b;
            })->values()->all();

        $validated['quick_replies'] = collect($validated['quick_replies'] ?? [])
            ->filter(fn ($q) => ! empty($q['title']))
            ->map(fn ($q) => ['title' => $q['title'], 'payload' => $q['title']])
            ->values()->all();

        return $validated;
    }

    protected function ownedPage(Request $request, int $pageId): FacebookPage
    {
        $page = FacebookPage::findOrFail($pageId);
        $this->tenant->authorizePage($request->user(), $page);

        return $page;
    }

    protected function activePages(Request $request): \Illuminate\Support\Collection
    {
        return $request->user()->facebookPages()->orderBy('name')->get(['id', 'name', 'status']);
    }
}
