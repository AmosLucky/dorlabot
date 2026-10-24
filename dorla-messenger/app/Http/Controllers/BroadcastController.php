<?php

namespace App\Http\Controllers;

use App\Models\Broadcast;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Services\MessageTemplateService;
use App\Services\MessagingEligibilityService;
use App\Services\MetaCredentialGuard;
use App\Services\BroadcastService;
use App\Services\TenantContextService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\View\View;

class BroadcastController extends Controller
{
    public function __construct(
        private readonly TenantContextService $tenant,
        private readonly MetaCredentialGuard $guard,
        private readonly MessageTemplateService $templates,
        private readonly MessagingEligibilityService $eligibility,
        private readonly BroadcastService $broadcasts,
    ) {}

    public function index(Request $request): View
    {
        $broadcasts = Broadcast::where('user_id', $request->user()->id)
            ->with('page:id,name')
            ->orderByDesc('id')->paginate(15);

        return view('broadcasts.index', ['broadcasts' => $broadcasts]);
    }

    public function create(Request $request): View
    {
        return view('broadcasts.create', [
            'pages' => $request->user()->facebookPages()->orderBy('name')->get(['id', 'name', 'status']),
            'tags' => \App\Models\ContactTag::where('user_id', $request->user()->id)->orderBy('name')->get(),
            'allowedTags' => config('meta.messaging.allowed_message_tags'),
            'variables' => $this->templates->supportedVariables(),
        ]);
    }

    /**
     * AJAX preview: renders the message with sample data and shows the
     * eligible/skipped audience split BEFORE anything is queued.
     */
    public function preview(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => ['required', 'integer'],
            'message_text' => ['required', 'string', 'max:1900'],
            'message_tag' => ['nullable', 'string', 'in:'.implode(',', config('meta.messaging.allowed_message_tags'))],
            'tag_filter' => ['nullable', 'array'],
        ]);

        $page = FacebookPage::where('user_id', $request->user()->id)->findOrFail($validated['facebook_page_id']);

        $errors = $this->templates->validate($validated['message_text']);
        if ($errors !== []) {
            return response()->json(['ok' => false, 'error' => implode(' ', $errors)], 422);
        }

        $audience = $this->broadcasts->buildAudience($page, $validated['tag_filter'] ?? null, $validated['message_tag'] ?? null);

        return response()->json([
            'ok' => true,
            'preview' => $this->templates->preview($validated['message_text'], $request->user()->id, $page),
            'total' => $audience['contacts']->count(),
            'eligible' => $audience['eligible']->count(),
            'skipped' => collect($audience['skipped'])->take(5)->map(fn ($s) => [
                'name' => $s['contact']->fullName(),
                'reason' => $s['reason'],
            ])->all(),
            'skipped_count' => count($audience['skipped']),
            'simulated' => ! $this->guard->liveOperationsEnabled(),
        ]);
    }

    /**
     * Send a test message to an authorized test recipient (a real contact
     * on the page, or simulated when credentials are absent).
     */
    public function sendTest(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => ['required', 'integer'],
            'message_text' => ['required', 'string', 'max:1900'],
            'test_psid' => ['required', 'string', 'max:120'],
        ]);

        $page = FacebookPage::where('user_id', $request->user()->id)->findOrFail($validated['facebook_page_id']);

        $rendered = $this->templates->render($validated['message_text'], null, $page);
        $contact = MessengerContact::where('facebook_page_id', $page->id)
            ->where('psid', $validated['test_psid'])->first();

        $result = app(\App\Services\MessengerSendService::class)->send($page, $validated['test_psid'], ['text' => $rendered], $contact);

        if (! $result['ok']) {
            return back()->with('error', 'Test send failed: '.$result['error']);
        }

        return back()->with($result['simulated'] ? 'info' : 'success',
            $result['simulated']
                ? 'SIMULATED test (live sending disabled). Rendered: "'.$rendered.'"'
                : 'Test message sent to the test recipient.');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => ['required', 'integer', 'exists:facebook_pages,id'],
            'name' => ['required', 'string', 'max:150'],
            'message_text' => ['required', 'string', 'max:1900'],
            'message_tag' => ['nullable', 'string', 'in:'.implode(',', config('meta.messaging.allowed_message_tags'))],
            'tag_filter' => ['nullable', 'array', 'max:20'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'action' => ['required', 'in:draft,queue,schedule'],
        ]);

        $page = FacebookPage::where('user_id', $request->user()->id)->findOrFail($validated['facebook_page_id']);

        // Monthly broadcast limit (plan limits).
        $usedThisMonth = Broadcast::where('user_id', $request->user()->id)
            ->whereIn('status', [Broadcast::STATUS_SCHEDULED, Broadcast::STATUS_QUEUED, Broadcast::STATUS_SENDING, Broadcast::STATUS_COMPLETED])
            ->where('created_at', '>=', now()->startOfMonth())->count();

        if ($usedThisMonth >= $request->user()->maxBroadcastsPerMonth()) {
            return back()->with('error', "Monthly broadcast limit reached ({$usedThisMonth}/".$request->user()->maxBroadcastsPerMonth().'). Upgrade your plan or wait for next month.')
                ->withInput();
        }

        $templateErrors = $this->templates->validate($validated['message_text']);
        if ($templateErrors !== []) {
            return back()->withErrors(['message_text' => $templateErrors])->withInput();
        }

        $status = match ($validated['action']) {
            'queue' => Broadcast::STATUS_QUEUED,
            'schedule' => Broadcast::STATUS_SCHEDULED,
            default => Broadcast::STATUS_DRAFT,
        };

        $broadcast = Broadcast::create([
            'user_id' => $request->user()->id,
            'facebook_page_id' => $page->id,
            'name' => $validated['name'],
            'message_text' => $validated['message_text'],
            'message_tag' => $validated['message_tag'] ?? null,
            'tag_filter' => ! empty($validated['tag_filter']) ? array_map('intval', $validated['tag_filter']) : null,
            'status' => $status,
            'scheduled_at' => $validated['scheduled_at'] ?? null,
        ]);

        if ($status === Broadcast::STATUS_QUEUED || $status === Broadcast::STATUS_SCHEDULED) {
            $this->broadcasts->queue($broadcast);
        }

        return redirect()->route('broadcasts.show', $broadcast)
            ->with('success', 'Broadcast "'.$broadcast->name.'" '.match ($status) {
                Broadcast::STATUS_QUEUED => 'queued — eligible recipients are being processed in the background.',
                Broadcast::STATUS_SCHEDULED => 'scheduled for '.$broadcast->scheduled_at->format('M j, Y H:i').'.',
                default => 'saved as draft.',
            });
    }

    public function show(Request $request, Broadcast $broadcast): View
    {
        $this->authorizeBroadcast($request, $broadcast);

        return view('broadcasts.show', [
            'broadcast' => $broadcast->load('page:id,name'),
            'recipients' => $broadcast->recipients()->with('contact:id,first_name,last_name,psid')
                ->orderByRaw("FIELD(status, 'failed','skipped','pending','queued','sent','delivered','read','clicked')")
                ->orderBy('id')->paginate(25),
            'skipSummary' => $broadcast->recipients()->where('status', 'skipped')
                ->selectRaw('skip_reason, COUNT(*) as n')->groupBy('skip_reason')->orderByDesc('n')->limit(10)->get(),
        ]);
    }

    public function destroy(Request $request, Broadcast $broadcast): RedirectResponse
    {
        $this->authorizeBroadcast($request, $broadcast);

        if (in_array($broadcast->status, [Broadcast::STATUS_SENDING, Broadcast::STATUS_QUEUED], true)) {
            return back()->with('error', 'Pause or cancel the broadcast before deleting it.');
        }

        $broadcast->delete();

        return redirect()->route('broadcasts.index')->with('success', 'Broadcast deleted.');
    }

    public function pause(Request $request, Broadcast $broadcast): RedirectResponse
    {
        $this->authorizeBroadcast($request, $broadcast);
        $this->broadcasts->pause($broadcast);

        return back()->with('success', 'Broadcast paused. Remaining recipients will wait.');
    }

    public function resume(Request $request, Broadcast $broadcast): RedirectResponse
    {
        $this->authorizeBroadcast($request, $broadcast);
        $this->broadcasts->resume($broadcast);

        return back()->with('success', 'Broadcast resumed.');
    }

    public function cancel(Request $request, Broadcast $broadcast): RedirectResponse
    {
        $this->authorizeBroadcast($request, $broadcast);
        $this->broadcasts->cancel($broadcast);

        return back()->with('success', 'Broadcast cancelled. Pending messages will not be sent.');
    }

    protected function authorizeBroadcast(Request $request, Broadcast $broadcast): void
    {
        if ((int) $broadcast->user_id !== (int) $request->user()->id) {
            abort(404);
        }
    }
}
