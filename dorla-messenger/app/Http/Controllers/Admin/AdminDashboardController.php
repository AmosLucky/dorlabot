<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AutomationRule;
use App\Models\Broadcast;
use App\Models\CommentEvent;
use App\Models\DataDeletionRequest;
use App\Models\FacebookPage;
use App\Models\IntegrationLog;
use App\Models\MessageEvent;
use App\Models\MessengerContact;
use App\Models\User;
use App\Models\WebhookEvent;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class AdminDashboardController extends Controller
{
    public function __invoke(): View
    {
        [$from, $to, $rangeLabel] = $this->resolveRange(request());

        $stats = [
            'users_total' => User::count(),
            'users_active' => User::where('status', 'active')->count(),
            'users_suspended' => User::where('status', 'suspended')->count(),
            'users_new' => User::whereBetween('created_at', [$from, $to])->count(),
            'pages_total' => FacebookPage::count(),
            'pages_active' => FacebookPage::where('status', FacebookPage::STATUS_CONNECTED)->count(),
            'pages_unhealthy' => FacebookPage::where('status', '!=', FacebookPage::STATUS_CONNECTED)->count(),
            'contacts_total' => MessengerContact::withTrashed()->count(),
            'automations_active' => AutomationRule::where('is_enabled', true)->count(),
            'broadcasts_total' => Broadcast::count(),
            'messages_total' => MessageEvent::count(),
            'comments_total' => CommentEvent::count(),
            'deletion_requests_open' => DataDeletionRequest::whereIn('status', ['pending', 'approved', 'processing'])->count(),
        ];

        // Platform usage chart: registrations + messages over time.
        $days = max(1, $from->diffInDays($to));
        $step = max(1, intdiv($days, 14));

        $usersDaily = User::whereBetween('created_at', [$from, $to])
            ->selectRaw('DATE(created_at) as d, COUNT(*) as n')->groupBy('d')->pluck('n', 'd');

        $messagesDaily = MessageEvent::whereBetween('occurred_at', [$from, $to])
            ->selectRaw('DATE(occurred_at) as d, COUNT(*) as n')->groupBy('d')->pluck('n', 'd');

        $labels = $usersSeries = $messagesSeries = [];
        for ($date = $from->copy(); $date <= $to; $date->addDays($step)) {
            $key = $date->toDateString();
            $labels[] = $date->format('M j');
            $usersSeries[] = (int) ($usersDaily[$key] ?? 0);
            $messagesSeries[] = (int) ($messagesDaily[$key] ?? 0);
        }

        return view('admin.dashboard', [
            'stats' => $stats,
            'rangeLabel' => $rangeLabel,
            'chart' => ['labels' => $labels, 'users' => $usersSeries, 'messages' => $messagesSeries],
            'recentUsers' => User::latest()->limit(6)->get(['id', 'name', 'email', 'status', 'created_at', 'last_login_at']),
            'recentEvents' => WebhookEvent::orderByDesc('id')->limit(8)->get(['id', 'event_key', 'field', 'status', 'received_at']),
            'recentErrors' => IntegrationLog::where('level', 'error')->orderByDesc('id')->limit(6)->get(),
            'queueHealth' => $this->queueHealth(),
        ]);
    }

    private function queueHealth(): array
    {
        try {
            $pending = \Illuminate\Support\Facades\DB::table('jobs')->count();
        } catch (\Throwable) {
            $pending = 0;
        }
        $failed = \Illuminate\Support\Facades\DB::table('failed_jobs')->count();

        return [
            'pending' => $pending,
            'failed' => $failed,
            'status' => $failed > 50 ? 'critical' : ($failed > 0 || $pending > 1000 ? 'warning' : 'healthy'),
        ];
    }

    private function resolveRange(\Illuminate\Http\Request $request): array
    {
        $preset = (string) $request->query('range', '30');
        $to = Carbon::today()->endOfDay();
        $from = match ($preset) {
            'today' => Carbon::today()->startOfDay(),
            '7' => Carbon::today()->subDays(6)->startOfDay(),
            '90' => Carbon::today()->subDays(89)->startOfDay(),
            default => Carbon::today()->subDays(29)->startOfDay(),
        };

        $label = match ($preset) {
            'today' => 'Today',
            '7' => 'Last 7 days',
            '90' => 'Last 90 days',
            default => 'Last 30 days',
        };

        return [$from, $to, $label];
    }
}
