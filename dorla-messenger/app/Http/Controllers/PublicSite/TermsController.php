<?php

namespace App\Http\Controllers\PublicSite;

use Illuminate\View\View;

class TermsController extends PublicPageController
{
    public function __invoke(): View
    {
        return view('public.terms', [
            'updated' => $this->setting('legal.terms_updated', 'October 2026'),
        ]);
    }
}
