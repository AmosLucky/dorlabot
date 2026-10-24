<?php

namespace App\Http\Controllers;

use App\Models\AutomationRule;
use App\Models\AutomationExecution;
use App\Models\Broadcast;
use App\Models\CommentEvent;
use App\Models\FacebookPage;
use App\Models\LinkClickEvent;
use App\Models\MessageEvent;
use App\Models\MessengerContact;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class AnalyticsController extends Controller
{
    /**
     * Performance analytics with date-range and per-page/per-campaign filters.
     * Metrics keep sent, delivered, read and clicked strictly separate.
     */
    public function index(\Illuminate\Http\Request $request): View
    {
        $user = $request->user();
        $pageIds = $user->facebookPages()->pluck('id');

        [$from, $to, $rangeLabel] = $this->resolveRange($request);

        $pageFilter = $request->filled('page') ? (int) $request->input('page') : null;

        $baseMessageQuery = MessageEvent::whereIn('facebook_page_id', $pageIds)
            ->whereBetween('occurred_at', [$from, $to])
            ->where('direction', 'outbound');

        if ($pageFilter !== null && $pageIds->contains($pageFilter)) {
            $baseMessageQuery->where('facebook_page_id', $pageFilter);
        }

        $totals = (clone $baseMessageQuery)
            ->selectRaw("SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent")
            ->selectRaw("SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) as attempted")
            ->selectRaw("SUM(CASE WHEN status IN ('delivered','read') THEN 1 ELSE 0 END) as delivered")
            ->selectRaw("SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as `read`")
            ->selectRaw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed")
            ->first();

        $clicks = LinkClickEvent::where('user_id', $user->id)
            ->whereBetween('clicked_at', [$from, $to])
            ->when($pageFilter !== null, fn ($q) => $q->whereHas('trackedLink', fn ($l) => $l->where('facebook_page_id', $pageFilter)))
            ->count();

        $uniqueClickers = LinkClickEvent::where('user_id', $user->id)
            ->whereBetween('clicked_at', [$from, $to])
            ->when($pageFilter !== null, fn ($q) => $q->whereHas('trackedLink', fn ($l) => $l->where('facebook_page_id', $pageFilter)))
            ->distinct('recipient_psid')->count('recipient_psid');

        $delivered = (int) ($totals->delivered ?? 0);

        // CTR = unique recipients who clicked / delivered messages x 100
        $ctr = $delivered > 0 ? round(($uniqueClickers / $delivered) * 100, 2) : 0.0;

        $byPage = FacebookPage::whereIn('id', $pageIds)
            ->when($pageFilter !== null, fn ($q) => $q->where('id', $pageFilter))
            ->withCount(['contacts'])
            ->get()
            ->map(function ($page) use ($from, $to) {
                $delivered = MessageEvent::where('facebook_page_id', $page->id)
                    ->whereBetween('occurred_at', [$from, $to])
                    ->where('direction', 'outbound')
                    ->whereIn('status', ['delivered', 'read'])->count();
                $clicks = LinkClickEvent::whereHas('trackedLink', fn ($l) => $l->where('facebook_page_id', $page->id))
                    ->whereBetween('clicked_at', [$from, $to])->count();

                return [
                    'page' => $page,
                    'sent' => MessageEvent::where('facebook_page_id', $page->id)
                        ->whereBetween('occurred_at', [$from, $to])->where('direction', 'outbound')->count(),
                    'delivered' => $delivered,
                    'clicks' => $clicks,
                    'ctr' => $delivered > 0 ? round(($clicks / $delivered) * 100, 2) : 0.0,
                ];
            });

        $byCampaign = Broadcast::where('user_id', $user->id)
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('id')->limit(10)->get()
            ->map(fn (Broadcast $b) => [
                'broadcast' => $b,
                'ctr' => $b->ctr(),
            ]);

        $byAutomation = AutomationRule::where('user_id', $user->id)
            ->withCount(['executions'])
            ->orderByDesc('executions_count')->limit(10)->get();

        // Trend chart.
        $daily = (clone $baseMessageQuery)
            ->selectRaw("DATE(occurred_at) as d, direction, SUM(CASE WHEN status='failed' THEN 0 ELSE 1 END) as n")
            ->groupBy('d', 'direction')->get()
            ->groupBy('d');

        $chartLabels = [];
        $outSeries = [];
        $clickSeries = [];

        $clickDaily = LinkClickEvent::where('user_id', $user->id)
            ->whereBetween('clicked_at', [$from, $to])
            ->selectRaw('DATE(clicked_at) as d, COUNT(*) as n')->groupBy('d')->pluck('n', 'd');

        $days = max(1, $from->diffInDays($to));
        $step = max(1, intdiv($days, 14));
        for ($date = $from->copy(); $date <= $to; $date->addDays($step)) {
            $key = $date->toDateString();
            $chartLabels[] = $date->format('M j');
            $outSeries[] = (int) ($daily[$key]?->where('direction', 'outbound')->sum('n') ?? 0);
            $clickSeries[] = (int) ($clickDaily[$key] ?? 0);
        }

        return view('analytics', [
            'rangeLabel' => $rangeLabel,
            'from' => $from, 'to' => $to,
            'pages' => FacebookPage::whereIn('id', $pageIds)->orderBy('name')->get(['id', 'name']),
            'selectedPage' => $pageFilter,
            'stats' => [
                'attempted' => (int) ($totals->attempted ?? 0),
                'sent' => (int) ($totals->sent ?? 0),
                'delivered' => $delivered,
                'read' => (int) ($totals->read ?? 0),
                'failed' => (int) ($totals->failed ?? 0),
                'clicks' => $clicks,
                'unique_clickers' => $uniqueClickers,
                'ctr' => $ctr,
            ],
            'byPage' => $byPage,
            'byCampaign' => $byCampaign,
            'byAutomation' => $byAutomation,
            'chart' => ['labels' => $chartLabels, 'messages' => $outSeries, 'clicks' => $clickSeries],
            'ctrFormula' => config('dorla.ctr_formula'),
        ]);
    }

    private function resolveRange(\Illuminate\Http\Request $request): array
    {
        $preset = (string) $request->query('range', '30');
        $to = Carbon::today()->endOfDay();
        $from = match ($preset) {
            'today' => Carbon::today()->startOfDay(),
            '7' => Carbon::today()->subDays(6)->startOfDay(),
            '90' => Carbon::today()->subDays(89)->startOfDay(),
            'custom' => Carbon::parse((string) $request->query('from', now()->subDays(29)->toDateString()))->startOfDay(),
            default => Carbon::today()->subDays(29)->startOfDay(),
        };

        if ($preset === 'custom') {
            $to = Carbon::parse((string) $request->query('to', now()->toDateString()))->endOfDay();
        }

        $label = match ($preset) {
            'today' => 'Today',
            '7' => 'Last 7 days',
            '90' => 'Last 90 days',
            'custom' => $from->format('M j, Y').' – '.$to->format('M j, Y'),
            default => 'Last 30 days',
        };

        return [$from, $to, $label];
    }
}
