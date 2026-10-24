<?php

namespace App\Http\Middleware;

use App\Services\MetaCredentialGuard;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The simulator is only reachable when DORLA_SIMULATION=true.
 */
class SimulationModeOnly
{
    public function __construct(
        private readonly MetaCredentialGuard $guard,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->guard->simulationEnabled()) {
            abort(404);
        }

        if (app()->environment('production')) {
            abort(404); // never in production, regardless of config
        }

        return $next($request);
    }
}
