<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AdminSettingController extends Controller
{
    public function edit(): View
    {
        $settings = SystemSetting::orderBy('group')->orderBy('key')->get()->groupBy('group');

        return view('admin.settings.edit', [
            'settings' => $settings,
            'groups' => [
                'site' => 'Public website content',
                'plans' => 'Pricing & plans',
                'limits' => 'Platform defaults & account limits',
                'general' => 'Other',
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*' => ['nullable', 'string', 'max:20000'],
        ]);

        foreach ($validated['settings'] as $key => $value) {
            $setting = SystemSetting::where('key', $key)->first();

            if ($setting === null) {
                continue; // only existing keys are editable (whitelist via UI)
            }

            // Plans stay JSON; everything else is plain string values.
            if (str_starts_with($key, 'plans.')) {
                $decoded = json_decode((string) $value, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    return back()->with('error', "Setting '{$key}' must be valid JSON.");
                }
                $setting->value = $decoded;
            } else {
                $setting->value = $value !== '' ? $value : null;
            }

            $setting->save();
            \Illuminate\Support\Facades\Cache::forget('system_setting.'.$key);
        }

        AuditLog::record('settings.updated', changes: array_keys($validated['settings']));

        return back()->with('success', 'Platform settings saved.');
    }
}
