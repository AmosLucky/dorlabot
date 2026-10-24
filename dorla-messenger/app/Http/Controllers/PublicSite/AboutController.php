<?php

namespace App\Http\Controllers\PublicSite;

use Illuminate\View\View;

class AboutController extends PublicPageController
{
    public function __invoke(): View
    {
        return view('public.about');
    }
}
