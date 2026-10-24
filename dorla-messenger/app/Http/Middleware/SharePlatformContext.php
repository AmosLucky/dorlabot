<?php

namespace App\Http\Middleware;

use App\Services\MetaCredentialGuard;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shares platform-wide view data: Meta credential status (so configuration
 * warnings render), the authenticated tenant, and system settings snippets.
 */
class SharePlatformContext
{
    public function __construct(
        private readonly MetaCredentialGuard $guard,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        View::share('metaConfigured', $this->guard->liveOperationsEnabled());
        View::share('metaMissingItems', $this->guard->missingItems());
        View::share('simulationMode', $this->guard->simulationEnabled());
        View::share('siteSettings', [
            'hero_title' => \App\Models\SystemSetting::value('site.hero_title'),
            'announcement' => \App\Models\SystemSetting::value('site.announcement'),
        ]);

        return $next($request);
    }
}
