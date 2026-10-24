@extends('layouts.public')
@section('title', 'Privacy Policy')
@section('content')
<section class="hero-wrap"><div class="container py-5 text-center"><h1 class="font-hero mb-2">Privacy Policy</h1><p class="text-muted mb-0">Last updated: {{ $updated }}</p></div></section>
<section class="section-pad pt-4"><div class="container"><div class="row justify-content-center"><div class="col-lg-8 legal-content">
    <h2 class="h4">1. What we collect</h2>
    <p class="text-muted small">When you register an account we store your name, email address, password (securely hashed), and optional business details. When you connect a Facebook Page we store the Page identifier, Page name, profile image URL, granted permissions, and an encrypted Page access token issued by Meta through the official Facebook Login flow. When people interact with your Page through our automations we store the Messenger-scoped identifiers (PSIDs) and interaction data Meta's APIs share with the app: names when available, message content needed for automation, timestamps and messaging eligibility information.</p>
    <h2 class="h4">2. How we use data</h2>
    <p class="text-muted small">Data is used only to operate the automation features you configure: sending replies, personalizing messages, building your Messenger contact list, analytics and first-party click tracking. We do not sell data, we do not scrape Facebook profiles, and we do not access data beyond what Meta's APIs and your granted permissions allow.</p>
    <h2 class="h4">3. Security</h2>
    <p class="text-muted small">Page access tokens are encrypted at rest. Webhooks are verified with HMAC-SHA256 signatures. Each customer's data is strictly isolated by server-side ownership checks. Administrative actions are audit-logged. We never log secrets such as tokens or app credentials.</p>
    <h2 class="h4">4. Data retention & deletion</h2>
    <p class="text-muted small">You can export your contacts to CSV, delete individual contacts, disconnect Pages (which deletes the stored token immediately), or request full account deletion from Settings → Data &amp; deletion. Approved deletion requests remove the account and associated personal data. We retain minimal audit records required for platform security.</p>
    <h2 class="h4">5. Third parties</h2>
    <p class="text-muted small">We share data only with Meta's APIs to deliver the messaging features you configure (sending messages, receiving webhooks). Hosting and email providers process data on our behalf under contract. See Meta's own privacy policy for how Meta processes data on its platform.</p>
    <h2 class="h4">6. Your rights</h2>
    <p class="text-muted small">Depending on your jurisdiction you may have rights to access, correct, export or delete your personal data. Use the in-app tools or contact us via the contact page to exercise them. We respond to all verified requests within applicable legal timeframes.</p>
    <h2 class="h4">7. Cookies</h2>
    <p class="text-muted small">We use essential cookies for authentication and session security, and local storage for interface preferences (e.g. light/dark theme). We do not use advertising cookies.</p>
    <h2 class="h4">8. Changes</h2>
    <p class="text-muted small">If this policy changes materially we will notify registered users by email and through the dashboard before the change takes effect.</p>
</div></div></div></section>
@endsection
