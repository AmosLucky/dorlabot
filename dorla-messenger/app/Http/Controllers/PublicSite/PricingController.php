<?php

namespace App\Http\Controllers\PublicSite;

use Illuminate\View\View;

class PricingController extends PublicPageController
{
    public function __invoke(): View
    {
        return view('public.pricing', ['plans' => $this->plans()]);
    }
}
