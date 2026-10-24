<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IntegrationLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class AdminSystemController extends Controller
{
    public function logs(Request $request): View
    {
        $logs = IntegrationLog::query()
            ->with(['user:id,name,email', 'page:id,name'])
            ->when($request->filled('level'), fn ($q) => $q->where('level', $request->input('level')))
            ->when($request->filled('channel'), fn ($q) => $q->where('channel', $request->input('channel')))
            ->when($request->filled('q'), fn ($q) => $q->where('operation', 'like', '%'.$request->string('q').'%'))
            ->orderByDesc('id')
            ->paginate(30)->withQueryString();

        return view('admin.logs', [
            'logs' => $logs,
            'levels' => ['info' => 'Info', 'warning' => 'Warning', 'error' => 'Error'],
            'channels' => ['meta' => 'Meta/Facebook', 'email' => 'Email', 'system' => 'System'],
        ]);
    }

    public function failedJobs(): View
    {
        $jobs = DB::table('failed_jobs')->orderByDesc('failed_at')->paginate(20);

        $decoded = collect($jobs->items())->map(function ($job) {
            $payload = json_decode((string) $job->payload, true);

            return (object) [
                'id' => $job->id,
                'uuid' => $job->uuid,
                'job' => $payload['displayName'] ?? 'unknown',
                'queue' => $payload['queue'] ?? 'default',
                'failed_at' => $job->failed_at,
                'exception' => \Illuminate\Support\Str::limit((string) $job->exception, 300),
            ];
        });

        return view('admin.failed-jobs', [
            'jobs' => $jobs,
            'decoded' => $decoded,
        ]);
    }

    public function retryJob(Request $request, string $uuid): RedirectResponse
    {
        Artisan::call('queue:retry', ['id' => [$uuid]]);

        return back()->with('success', 'Failed job pushed back onto its queue.');
    }

    public function deleteJob(Request $request, string $uuid): RedirectResponse
    {
        Artisan::call('queue:forget', ['id' => $uuid]);

        return back()->with('success', 'Failed job deleted.');
    }
}
