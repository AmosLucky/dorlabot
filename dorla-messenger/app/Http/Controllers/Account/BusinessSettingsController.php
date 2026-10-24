<?php

namespace App\Http\Controllers\Account;

use App\Http\Controllers\Controller;
use App\Models\AccountSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class BusinessSettingsController extends Controller
{
    public function edit(Request $request): View
    {
        $setting = AccountSetting::firstOrCreate(['user_id' => $request->user()->id]);

        return view('settings.business', ['setting' => $setting]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:150'],
            'support_email' => ['nullable', 'email', 'max:150'],
            'default_fallback_first_name' => ['required', 'string', 'max:50'],
        ]);

        AccountSetting::updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated,
        );

        return back()->with('success', 'Business settings saved. Personalization variables will use these values.');
    }
}
