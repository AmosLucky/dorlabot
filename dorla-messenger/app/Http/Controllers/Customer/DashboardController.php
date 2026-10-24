<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\AutomationExecution;
use App\Models\AutomationRule;
use App\Models\Broadcast;
use App\Models\CommentEvent;
use App\Models\FacebookPage;
use App\Models\IntegrationLog;
use App\Models\MessageEvent;
use App\Models\MessengerContact;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function __invoke(\Illuminate\Http\Request $request): View
    {
        $user = $request->user();
        [$from, $to, $rangeLabel] = $this->resolveRange($request);

        $pages = FacebookPage::where('user_id', $user->id)->orderBy('name')->get();
        $pageIds = $pages->pluck('id');

        $contacts = MessengerContact::whereIn('facebook_page_id', $pageIds)->get();
        $newContacts = (clone $contacts)->where('first_interaction_at', '>=', $from)->count();

        $messageEvents = MessageEvent::whereIn('facebook_page_id', $pageIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw("direction, status, COUNT(*) as n")
            ->groupBy('direction', 'status')
            ->get();

        $messagesSent = $messageEvents->where('direction', 'outbound')->sum('n');
        $messagesDelivered = $messageEvents->where('direction', 'outbound')->whereIn('status', ['delivered', 'read'])->sum('n');
        $messagesRead = $messageEvents->where('direction', 'outbound')->where('status', 'read')->sum('n');
        $messagesInbound = $messageEvents->where('direction', 'inbound')->sum('n');

        $clicks = \App\Models\LinkClickEvent::where('user_id', $user->id)
            ->whereBetween('clicked_at', [$from, $to])->count();

        $ctr = $messagesDelivered > 0 ? round(($clicks / $messagesDelivered) * 100, 2) : 0.0;

        $activeAutomations = AutomationRule::whereIn('facebook_page_id', $pageIds)
            ->where('is_enabled', true)->count();

        $recentConversations = \App\Models\Conversation::whereIn('facebook_page_id', $pageIds)
            ->with(['contact', 'page'])
            ->orderByDesc('last_message_at')->limit(6)->get();

        $recentExecutions = AutomationExecution::where('user_id', $user->id)
            ->with(['rule', 'page'])
            ->orderByDesc('id')->limit(6)->get();

        $broadcasts = Broadcast::where('user_id', $user->id)
            ->orderByDesc('id')->limit(5)->get();

        $unhealthyPages = $pages->filter(fn ($p) => ! $p->isHealthy());

        $recentErrors = IntegrationLog::where('user_id', $user->id)
            ->where('level', 'error')->orderByDesc('id')->limit(5)->get();

        // Chart data: messages over time (in vs out) and new contacts.
        $days = $from->diffInDays($to);
        $chartLabels = [];
        $outboundSeries = [];
        $inboundSeries = [];
        $contactsSeries = [];

        $outboundDaily = MessageEvent::whereIn('facebook_page_id', $pageIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->where('direction', 'outbound')
            ->selectRaw('DATE(occurred_at) as d, COUNT(*) as n')
            ->groupBy('d')->pluck('n', 'd');

        $inboundDaily = MessageEvent::whereIn('facebook_page_id', $pageIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->where('direction', 'inbound')
            ->selectRaw('DATE(occurred_at) as d, COUNT(*) as n')
            ->groupBy('d')->pluck('n', 'd');

        $contactsDaily = MessengerContact::whereIn('facebook_page_id', $pageIds)
            ->whereBetween('first_interaction_at', [$from, $to])
            ->selectRaw('DATE(first_interaction_at) as d, COUNT(*) as n')
            ->groupBy('d')->pluck('n', 'd');

        $step = max(1, intdiv($days, 14));
        for ($date = $from->copy(); $date <= $to; $date->addDays($step)) {
            $key = $date->toDateString();
            $chartLabels[] = $date->format('M j');
            $outboundSeries[] = (int) ($outboundDaily[$key] ?? 0);
            $inboundSeries[] = (int) ($inboundDaily[$key] ?? 0);
            $contactsSeries[] = (int) ($contactsDaily[$key] ?? 0);
        }

        return view('dashboard', [
            'rangeLabel' => $rangeLabel,
            'from' => $from, 'to' => $to,
            'pages' => $pages,
            'stats' => [
                'pages' => $pages->count(),
                'contacts' => $contacts->count(),
                'new_contacts' => $newContacts,
                'messages_sent' => $messagesSent,
                'messages_delivered' => $messagesDelivered,
                'messages_read' => $messagesRead,
                'messages_inbound' => $messagesInbound,
                'clicks' => $clicks,
                'ctr' => $ctr,
                'active_automations' => $activeAutomations,
                'unhealthy_pages' => $unhealthyPages->count(),
            ],
            'recentConversations' => $recentConversations,
            'recentExecutions' => $recentExecutions,
            'broadcasts' => $broadcasts,
            'unhealthyPages' => $unhealthyPages,
            'recentErrors' => $recentErrors,
            'chart' => [
                'labels' => $chartLabels,
                'outbound' => $outboundSeries,
                'inbound' => $inboundSeries,
                'contacts' => $contactsSeries,
            ],
        ]);
    }

    private function resolveRange(\Illuminate\Http\Request $request): array
    {
        $preset = (string) $request->query('range', '7');
        $to = Carbon::today()->endOfDay();
        $from = match ($preset) {
            'today' => Carbon::today()->startOfDay(),
            '30' => Carbon::today()->subDays(29)->startOfDay(),
            'custom' => Carbon::parse((string) $request->query('from', now()->subDays(6)->toDateString()))->startOfDay(),
            default => Carbon::today()->subDays(6)->startOfDay(),
        };

        if ($preset === 'custom') {
            $to = Carbon::parse((string) $request->query('to', now()->toDateString()))->endOfDay();
        }

        $label = match ($preset) {
            'today' => 'Today',
            '30' => 'Last 30 days',
            'custom' => $from->format('M j, Y').' – '.$to->format('M j, Y'),
            default => 'Last 7 days',
        };

        return [$from, $to, $label];
    }
}
