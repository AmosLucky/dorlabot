<?php

namespace App\Http\Controllers\PublicSite;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Contracts\View\View;

/**
 * Simple marketing pages driven by editable system settings with sensible
 * built-in defaults.
 */
abstract class PublicPageController extends Controller
{
    protected function setting(string $key, string $fallback): string
    {
        return (string) (SystemSetting::value($key) ?? $fallback);
    }

    protected function plans(): array
    {
        return (array) (SystemSetting::value('plans.list') ?? config('dorla.plans.defaults'));
    }
}
