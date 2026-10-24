<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Production deployments are commonly served behind shared-hosting
        // proxies / CDNs; trust them so generated URLs and secure cookies
        // resolve to https://dorlacode.com correctly.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'super.admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'user.active' => \App\Http\Middleware\EnsureUserActive::class,
            'meta.simulation' => \App\Http\Middleware\SimulationModeOnly::class,
        ]);

        $middleware->web(append: [
            \App\Http\Middleware\SharePlatformContext::class,
        ]);

        // Webhook endpoints must be excluded from CSRF verification;
        // authenticity is enforced with the X-Hub-Signature-256 header check.
        $middleware->validateCsrfTokens(except: [
            'webhooks/meta/messenger',
        ]);

        $middleware->redirectGuestsTo(fn () => route('login'));
        $middleware->redirectUsersTo(fn () => route('dashboard'));
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
