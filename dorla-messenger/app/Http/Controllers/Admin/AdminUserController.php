<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Broadcast;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Models\AutomationRule;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\View\View;

class AdminUserController extends Controller
{
    public function index(Request $request): View
    {
        $users = User::query()
            ->withCount(['facebookPages', 'contacts'])
            ->when($request->filled('q'), function ($q) use ($request): void {
                $term = (string) $request->input('q');
                $q->where(fn ($w) => $w->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%"));
            })
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->input('status')))
            ->orderBy($request->input('sort', 'created_at'), $request->input('dir', 'desc'))
            ->paginate(20)->withQueryString();

        return view('admin.users.index', [
            'users' => $users,
            'statuses' => ['active' => 'Active', 'suspended' => 'Suspended'],
        ]);
    }

    public function show(Request $request, User $user): View
    {
        return view('admin.users.show', [
            'user' => $user->loadCount(['facebookPages', 'contacts', 'broadcasts', 'automations']),
            'pages' => FacebookPage::where('user_id', $user->id)->get(),
            'broadcasts' => Broadcast::where('user_id', $user->id)->latest()->limit(10)->get(),
            'automations' => AutomationRule::where('user_id', $user->id)->with('page:id,name')->limit(10)->get(),
            'auditLogs' => AuditLog::where('target_user_id', $user->id)->orWhere('actor_user_id', $user->id)->latest()->limit(15)->get(),
            'notes' => $user->admin_notes,
        ]);
    }

    public function suspend(Request $request, User $user): RedirectResponse
    {
        if ($user->isSuperAdmin() && $user->id === $request->user()->id) {
            return back()->with('error', 'You cannot suspend your own account.');
        }

        $user->forceFill(['status' => 'suspended'])->save();

        AuditLog::record('user.suspended', targetId: $user->id, subjectType: User::class, subjectId: $user->id, changes: ['status' => 'suspended']);

        return back()->with('success', $user->name.' has been suspended.');
    }

    public function activate(Request $request, User $user): RedirectResponse
    {
        $user->forceFill(['status' => 'active'])->save();

        AuditLog::record('user.activated', targetId: $user->id, subjectType: User::class, subjectId: $user->id, changes: ['status' => 'active']);

        return back()->with('success', $user->name.' has been re-activated.');
    }

    /**
     * Trigger the standard password-reset flow (admin never sees or sets
     * the customer's password directly).
     */
    public function sendPasswordReset(Request $request, User $user): RedirectResponse
    {
        Password::sendResetLink(['email' => $user->email]);

        AuditLog::record('user.password_reset_sent', targetId: $user->id, subjectType: User::class, subjectId: $user->id);

        return back()->with('success', 'Password reset link sent to '.$user->email.'.');
    }

    public function addNote(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate(['admin_notes' => ['required', 'string', 'max:5000']]);

        $user->forceFill(['admin_notes' => $validated['admin_notes']])->save();

        AuditLog::record('user.notes_updated', targetId: $user->id, subjectType: User::class, subjectId: $user->id);

        return back()->with('success', 'Internal support notes saved.');
    }

    /**
     * Enforce per-account limits (pages / contacts / monthly broadcasts).
     */
    public function updateLimits(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'max_pages' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'max_contacts' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'max_broadcasts_per_month' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);

        $user->update($validated);

        AuditLog::record('user.limits_updated', targetId: $user->id, subjectType: User::class, subjectId: $user->id, changes: $validated);

        return back()->with('success', 'Account limits updated.');
    }
}
