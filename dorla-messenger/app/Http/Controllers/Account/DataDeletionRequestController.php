<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\DataDeletionRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DataDeletionRequestController extends Controller
{
    public function create(Request $request): View
    {
        $existing = DataDeletionRequest::where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'approved', 'processing'])
            ->latest()->first();

        return view('settings.data-deletion', ['existing' => $existing]);
    }

    public function store(Request $request): RedirectResponse
    {
        $open = DataDeletionRequest::where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'approved', 'processing'])
            ->exists();

        if ($open) {
            return back()->with('info', 'You already have an open deletion request being processed.');
        }

        DataDeletionRequest::create([
            'user_id' => $request->user()->id,
            'email' => $request->user()->email,
            'status' => 'pending',
            'reason' => $request->input('reason'),
            'requested_at' => now(),
        ]);

        return back()->with('success', 'Deletion request submitted. Our team will review and process it — you will receive confirmation by email.');
    }
}
