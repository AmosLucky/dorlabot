<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DataDeletionRequest;
use App\Services\DataDeletionService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AdminDeletionRequestController extends Controller
{
    public function index(): View
    {
        return view('admin.deletion-requests', [
            'requests' => DataDeletionRequest::with('user')->orderByDesc('id')->paginate(20),
        ]);
    }

    /**
     * Approve -> immediate deletion; reject -> record note.
     */
    public function process(Request $request, DataDeletionRequest $dataDeletionRequest): RedirectResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'in:approve,reject'],
            'admin_note' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($validated['decision'] === 'approve') {
            app(DataDeletionService::class)->executeDeletion($dataDeletionRequest);

            AuditLog::record('deletion_request.executed', targetId: $dataDeletionRequest->user_id, subjectType: DataDeletionRequest::class, subjectId: $dataDeletionRequest->id);

            return back()->with('success', 'Data deletion executed. Account and personal data have been removed.');
        }

        $dataDeletionRequest->forceFill([
            'status' => DataDeletionRequest::STATUS_REJECTED,
            'admin_note' => $validated['admin_note'],
            'processed_at' => now(),
            'processed_by_user_id' => $request->user()->id,
        ])->save();

        AuditLog::record('deletion_request.rejected', targetId: $dataDeletionRequest->user_id, subjectType: DataDeletionRequest::class, subjectId: $dataDeletionRequest->id);

        return back()->with('success', 'Deletion request rejected with note.');
    }
}
