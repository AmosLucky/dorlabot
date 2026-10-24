<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Suspended accounts cannot use the platform; they are logged out with a
 * clear message. Activated-but-unverified users are sent to verification.
 */
class EnsureUserActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        if ($user->status !== 'active') {
            auth()->logout();

            return redirect()->route('login')->withErrors([
                'email' => 'Your account is suspended. Contact support at '.config('meta.app_url').'/contact for help.',
            ]);
        }

        return $next($request);
    }
}
