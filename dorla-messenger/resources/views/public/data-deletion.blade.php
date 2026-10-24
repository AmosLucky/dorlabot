@extends('layouts.public')
@section('title', 'Data Deletion Instructions')
@section('content')
<section class="hero-wrap"><div class="container py-5 text-center"><h1 class="font-hero mb-3">Data deletion instructions</h1>
<p class="font-sub-hero mx-auto" style="max-width: 44rem">How to remove your personal data from {{ config('app.name') }} — as a registered user, as a Messenger user who interacted with a Page, or via Meta's own tools.</p>
</div></section>
<section class="section-pad pt-4"><div class="container"><div class="row g-4 justify-content-center">
    <div class="col-lg-4"><div class="feature-card h-100">
        <span class="feature-icon"><i class="bi bi-person-x"></i></span>
        <h2 class="h5">Registered users</h2>
        <p class="small text-muted">Log in, open <strong>Settings → Data &amp; deletion</strong>, and submit a deletion request. Once approved, your account, connected Pages (with stored tokens), contacts, messages and personalization data are permanently removed.</p>
    </div></div>
    <div class="col-lg-4"><div class="feature-card h-100">
        <span class="feature-icon"><i class="bi bi-chat-square-x"></i></span>
        <h2 class="h5">Messenger users</h2>
        <p class="small text-muted">If you interacted with a business Page through this platform, contact that business to request deletion of your contact record — page owners can delete any contact (and their message history) from their Contacts screen, or export data first if you prefer a copy.</p>
    </div></div>
    <div class="col-lg-4"><div class="feature-card h-100">
        <span class="feature-icon"><i class="bi bi-facebook"></i></span>
        <h2 class="h5">Via Meta settings</h2>
        <p class="small text-muted">You can also remove this app from your Facebook account (Settings → Apps and websites). Removing the app stops all future access; to erase already-stored data, use one of the methods above.</p>
    </div></div>
    <div class="col-lg-8"><div class="feature-card">
        <h2 class="h5">What gets deleted</h2>
        <ul class="small text-muted mb-0">
            <li>Your account profile, login and business settings</li>
            <li>Encrypted Page access tokens (also revoked on the Page connection)</li>
            <li>Messenger contacts (names, PSIDs, tags, custom fields, message history)</li>
            <li>Automation rules, broadcasts you created and their recipient records</li>
        </ul>
        <p class="small text-muted mt-2 mb-0">Minimal security audit records may be retained where required for platform integrity. Requests are processed within 30 days.</p>
    </div></div>
</div></div></section>
@endsection
