<?php

namespace App\Http\Controllers;

use App\Models\TrackedLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * First-party click tracking endpoint: /c/{trackingCode}
 * Records the click then redirects ONLY to the stored, validated
 * destination — query strings from the visitor can never alter the target
 * (open-redirect protection).
 */
class ClickTrackingController extends Controller
{
    public function __invoke(Request $request, string $trackingCode): RedirectResponse
    {
        $service = app(\App\Services\ClickTrackingService::class);

        $result = $service->recordClick(
            $trackingCode,
            $request->ip(),
            $request->userAgent(),
            $request->query('psid'),
        );

        $destination = $result['destination'];

        if ($destination === null) {
            abort(404, 'This link is no longer valid.');
        }

        return redirect()->away($destination, 302);
    }
}
