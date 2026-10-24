<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Providers\AppServiceProvider;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;

class EmailVerificationController extends Controller
{
    public function notice(): \Illuminate\View\View|\Illuminate\Http\RedirectResponse
    {
        if (request()->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        return view('auth.verify-email');
    }

    /**
     * Signed verification link handler (email verification without IDOR:
     * the id/hash combination is protected by the signed URL).
     */
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        $user = \App\Models\User::findOrFail($id);

        if (! hash_equals(sha1((string) $user->email), (string) $hash)) {
            abort(403, 'Invalid verification link.');
        }

        if (! URL::hasValidSignature($request)) {
            abort(403, 'Invalid or expired verification link.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
            Event::dispatch(new \Illuminate\Auth\Events\Verified($user));
        }

        return redirect()->route('dashboard')->with('success', 'Email verified successfully!');
    }

    public function resend(Request $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->route('dashboard');
        }

        $request->user()->sendEmailVerificationNotification();

        return back()->with('success', 'Verification link sent! Check your inbox.');
    }
}
