<?php

namespace App\Http\Controllers\PublicSite;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\View\View;

class HomeController extends Controller
{
    public function __invoke(): View
    {
        return view('public.home', [
            'plans' => $this->plans(),
            'faqs' => [
                [
                    'q' => 'Do I need any technical skills to use this?',
                    'a' => 'No. Connect your Facebook Page in a few clicks using the official Facebook login, then switch on the automations you want with simple editors — no coding involved.',
                ],
                [
                    'q' => 'How does comment-to-Messenger work?',
                    'a' => 'When someone comments on a post you selected, we can send them a private reply in Messenger (where Meta rules allow). One private reply per comment within the allowed time window, and the conversation continues only when the person replies or taps a button.',
                ],
                [
                    'q' => 'Will my messages look personal?',
                    'a' => 'Yes. Personalization variables like {{first_name}} and {{business_name}} are filled in for every recipient, with safe fallbacks when data is unavailable.',
                ],
                [
                    'q' => 'Is this an official Meta product?',
                    'a' => 'No. Dorla Messenger Automation is an independent platform that integrates with the official Meta Graph API and Messenger Platform. It is not endorsed by or affiliated with Meta.',
                ],
                [
                    'q' => 'What happens if someone is not eligible to receive a broadcast?',
                    'a' => 'They are skipped automatically and the reason is recorded (e.g. outside the 24-hour messaging window). You always see delivered vs skipped counts — we never force messages through.',
                ],
                [
                    'q' => 'Can I delete my data?',
                    'a' => 'Yes. You can export contacts to CSV, delete individual contacts, or request a full account and data deletion from Settings at any time.',
                ],
            ],
        ]);
    }
}
