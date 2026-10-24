<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessCommentEvent;
use App\Jobs\ProcessIncomingMessage;
use App\Models\FacebookPage;
use App\Services\MetaCredentialGuard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Development simulator (simulation mode only, never available in
 * production): dispatches clearly-labeled SIMULATED Meta events through
 * the real processing pipeline so automation flows can be exercised
 * end-to-end without live credentials.
 */
class SimulatorController extends Controller
{
    public function __construct(
        private readonly MetaCredentialGuard $guard,
    ) {}

    public function index(Request $request): View
    {
        return view('simulator.index', [
            'pages' => $request->user()->facebookPages()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function dispatchEvent(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'facebook_page_id' => ['required', 'integer'],
            'event_type' => ['required', 'in:message,postback,comment,delivery,read'],
            'sender_psid' => ['required', 'string', 'max:120'],
            'text' => ['nullable', 'string', 'max:500'],
            'comment_id' => ['nullable', 'string', 'max:120', 'required_if:event_type,comment'],
            'post_id' => ['nullable', 'string', 'max:120'],
        ]);

        $page = FacebookPage::where('user_id', $request->user()->id)->findOrFail($validated['facebook_page_id']);

        $senderId = $validated['sender_psid'];

        switch ($validated['event_type']) {
            case 'message':
                ProcessIncomingMessage::dispatch($page->id, [
                    'sender' => ['id' => $senderId],
                    'recipient' => ['id' => $page->meta_page_id],
                    'timestamp' => now()->getPreciseTimestamp(3),
                    'message' => [
                        'mid' => 'sim_'.uniqid(),
                        'text' => $validated['text'] ?? 'Hello!',
                    ],
                ], false)->onQueue('messaging');
                break;

            case 'postback':
                ProcessIncomingMessage::dispatch($page->id, [
                    'sender' => ['id' => $senderId],
                    'recipient' => ['id' => $page->meta_page_id],
                    'timestamp' => now()->getPreciseTimestamp(3),
                    'postback' => [
                        'payload' => $validated['text'] ?? 'GET_STARTED',
                        'title' => 'Simulated postback',
                    ],
                ], false)->onQueue('messaging');
                break;

            case 'comment':
                ProcessCommentEvent::dispatch($page->id, [
                    'item' => 'comment',
                    'verb' => 'add',
                    'comment_id' => $validated['comment_id'],
                    'post_id' => $validated['post_id'] ?? 'sim_post_1',
                    'from' => ['id' => $senderId, 'name' => 'Simulated Commenter'],
                    'message' => $validated['text'] ?? 'I want the link please',
                    'created_time' => now()->toIso8601String(),
                    'is_simulated' => true,
                ])->onQueue('comments');
                break;

            case 'delivery':
                ProcessIncomingMessage::dispatch($page->id, [
                    'sender' => ['id' => $senderId],
                    'delivery' => ['mids' => ['sim_mid_1'], 'watermark' => now()->getPreciseTimestamp(3)],
                ], false)->onQueue('messaging');
                break;

            case 'read':
                ProcessIncomingMessage::dispatch($page->id, [
                    'sender' => ['id' => $senderId],
                    'read' => ['watermark' => now()->getPreciseTimestamp(3)],
                ], false)->onQueue('messaging');
                break;
        }

        return back()->with('success', 'SIMULATED '.$validated['event_type'].' event queued for "'.$page->name.'". Start the queue worker (or run queue:work --once) to process it.');
    }
}
