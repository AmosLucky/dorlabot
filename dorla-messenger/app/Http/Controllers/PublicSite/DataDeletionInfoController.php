<?php

namespace App\Http\Controllers\PublicSite;

use Illuminate\View\View;

class DataDeletionInfoController extends PublicPageController
{
    public function __invoke(): View
    {
        return view('public.data-deletion');
    }
}
