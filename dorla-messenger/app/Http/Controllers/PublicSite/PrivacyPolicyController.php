<?php

namespace App\Http\Controllers\PublicSite;

use Illuminate\View\View;

class PrivacyPolicyController extends PublicPageController
{
    public function __invoke(): View
    {
        return view('public.privacy', [
            'updated' => $this->setting('legal.privacy_updated', 'October 2026'),
        ]);
    }
}
