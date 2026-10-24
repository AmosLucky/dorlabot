@extends('layouts.public')
@section('title', 'Terms of Service')
@section('content')
<section class="hero-wrap"><div class="container py-5 text-center"><h1 class="font-hero mb-2">Terms of Service</h1><p class="text-muted mb-0">Last updated: {{ $updated }}</p></div></section>
<section class="section-pad pt-4"><div class="container"><div class="row justify-content-center"><div class="col-lg-8">
    <h2 class="h4">1. The service</h2>
    <p class="text-muted small">{{ config('app.name') }} provides Facebook Messenger automation tools — welcome messages, automatic replies, comment-to-Messenger private replies, subscriber management, eligible broadcasts and analytics — built on the official Meta Graph API and Messenger Platform.</p>
    <h2 class="h4">2. Your account</h2>
    <p class="text-muted small">You must provide accurate registration information and keep your credentials secure. You are responsible for all activity under your account. Each account may only connect Facebook Pages you own or have permission to manage.</p>
    <h2 class="h4">3. Acceptable use</h2>
    <p class="text-muted small">You agree to use the platform in compliance with Meta Platform Terms, the Messenger Platform policy, and applicable laws. Prohibited: unsolicited bulk messaging, bypassing messaging-window restrictions, harassment, misleading content, scraping, and any use that could cause this platform's Meta app to violate Meta policy. We may suspend accounts that endanger platform-wide compliance.</p>
    <h2 class="h4">4. Messaging rules</h2>
    <p class="text-muted small">The platform enforces Meta's messaging rules (24-hour standard window, message tags, private-reply limits). Recipients who are ineligible are skipped with a recorded reason. The platform never guarantees delivery, read receipts, or that Meta will accept a given send.</p>
    <h2 class="h4">5. Fees & plans</h2>
    <p class="text-muted small">Plan limits and prices are shown on the pricing page and configurable by the platform administrator. Subscription fees cover the Dorla platform only; you remain responsible for any costs Meta charges you directly, if any. Fees are non-refundable except where required by law.</p>
    <h2 class="h4">6. Intellectual property</h2>
    <p class="text-muted small">The platform software, design and content are owned by the operator. You keep all rights to your own content, Page data and contact data.</p>
    <h2 class="h4">7. Limitation of liability</h2>
    <p class="text-muted small">The service is provided "as is". To the maximum extent permitted by law the operator is not liable for indirect, incidental or consequential damages, lost profits, or data loss arising from use of the service or from actions taken by Meta (e.g. API changes, Page restrictions, app review outcomes).</p>
    <h2 class="h4">8. Termination</h2>
    <p class="text-muted small">You may stop using the service and delete your account at any time. We may suspend or terminate accounts that violate these terms or Meta policy, with notice where practicable.</p>
    <h2 class="h4">9. Changes</h2>
    <p class="text-muted small">We may update these terms; material changes will be communicated through the dashboard or email before taking effect. Continued use after the effective date constitutes acceptance.</p>
</div></div></div></section>
@endsection
