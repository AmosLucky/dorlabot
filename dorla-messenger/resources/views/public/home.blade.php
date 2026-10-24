@extends('layouts.public')

@section('title', 'Automate Facebook Messenger Conversations')
@section('meta_description', 'Dorla Messenger Automation sends personalized welcome messages, auto-replies and comment-to-DM responses on your Facebook Page using the official Meta Messenger Platform.')

@section('content')
    {{-- ============ HERO ============ --}}
    <section class="hero-wrap">
        <div class="container py-5">
            <div class="row align-items-center g-5 py-lg-4">
                <div class="col-lg-6">
                    <span class="badge badge-soft-primary mb-3"><i class="bi bi-patch-check me-1"></i> Official Meta Messenger Platform integration</span>
                    <h1 class="font-hero mb-3">Automate your Messenger conversations.<br>Save hours every week.</h1>
                    <p class="font-sub-hero mb-4">Turn comments into Messenger conversations, welcome every new subscriber by name, and send policy-safe broadcasts — all from one beautiful dashboard built for non-technical business owners.</p>
                    <div class="d-flex flex-wrap gap-2 mb-4">
                        <a href="{{ route('register') }}" class="btn btn-primary btn-lg px-4"><i class="bi bi-rocket-takeoff me-2"></i>Create your free account</a>
                        <a href="{{ route('login') }}" class="btn btn-light btn-lg px-4">Log in</a>
                    </div>
                    <div class="d-flex flex-wrap gap-4 small text-muted">
                        <span><i class="bi bi-check2-circle text-success me-1"></i>Connects via official Facebook login</span>
                        <span><i class="bi bi-check2-circle text-success me-1"></i>No credit card to start</span>
                        <span><i class="bi bi-check2-circle text-success me-1"></i>Personalized with {{ '{{first_name}}' }}</span>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="hero-dashboard-preview p-3">
                        <div class="d-flex gap-1 mb-3 px-2 pt-1">
                            <span class="bg-danger-subtle rounded-circle d-inline-block" style="width:10px;height:10px"></span>
                            <span class="bg-warning-subtle rounded-circle d-inline-block" style="width:10px;height:10px"></span>
                            <span class="bg-success-subtle rounded-circle d-inline-block" style="width:10px;height:10px"></span>
                        </div>
                        <div class="row g-3">
                            <div class="col-4"><div class="stat-card"><div class="stat-label">Contacts</div><div class="stat-value">1,248</div></div></div>
                            <div class="col-4"><div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value">98.2%</div></div></div>
                            <div class="col-4"><div class="stat-card"><div class="stat-label">CTR</div><div class="stat-value">12.6%</div></div></div>
                            <div class="col-12">
                                <div class="d-flex flex-column gap-2 px-1 pb-2">
                                    <div class="chat-bubble-demo"><strong>Amina</strong> · just now<br>Hi! I saw your post about the promo code 👀</div>
                                    <div class="chat-bubble-demo out"><strong>Auto-reply</strong><br>Hi Amina! 👋 Thanks for commenting! Tap below and I'll send your code right over. <span class="d-block small mt-1 opacity-75">ⓘ Sent by "Comment automation — Promo post"</span></div>
                                    <div class="chat-bubble-demo"><strong>Amina</strong><br>Wow that was fast. Thank you!</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ FEATURES ============ --}}
    <section class="section-pad bg-body-tertiary" id="features">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="mb-2">Everything your Page needs to answer first</h2>
                <p class="text-muted mb-0">Four automation pillars, one dashboard, zero code.</p>
            </div>
            <div class="row g-4">
                <div class="col-md-6 col-lg-3">
                    <div class="feature-card">
                        <span class="feature-icon"><i class="bi bi-chat-heart"></i></span>
                        <h3 class="h5">Welcome messages</h3>
                        <p class="small text-muted mb-0">Greet every first-time contact automatically with a personalized note and quick-reply buttons that route conversations where you want them.</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="feature-card">
                        <span class="feature-icon"><i class="bi bi-reply-all"></i></span>
                        <h3 class="h5">Automatic DM replies</h3>
                        <p class="small text-muted mb-0">A smart default reply plus keyword rules ("PRICE", "HOURS"…) with business-hours handling and human handoff options.</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="feature-card">
                        <span class="feature-icon"><i class="bi bi-chat-dots"></i></span>
                        <h3 class="h5">Comment-to-Messenger</h3>
                        <p class="small text-muted mb-0">Pick a post and send eligible commenters a private reply in Messenger — one per comment, inside Meta's allowed time window.</p>
                    </div>
                </div>
                <div class="col-md-6 col-lg-3">
                    <div class="feature-card">
                        <span class="feature-icon"><i class="bi bi-megaphone"></i></span>
                        <h3 class="h5">Eligible broadcasts</h3>
                        <p class="small text-muted mb-0">Compose, personalize, schedule and track broadcasts. Ineligible recipients are skipped automatically with clear reasons.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ COMMENT-TO-MESSENGER EXPLAINED ============ --}}
    <section class="section-pad">
        <div class="container">
            <div class="row align-items-center g-5">
                <div class="col-lg-6">
                    <span class="badge badge-soft-primary mb-3">Comment automation</span>
                    <h2 class="mb-3">Turn every comment into a private conversation</h2>
                    <p class="text-muted">Choose any eligible post on your connected Page. When someone comments, Dorla sends them a private Messenger reply — instantly, personally, and strictly within Meta's private-reply rules: one reply per comment, inside the permitted window.</p>
                    <ul class="list-unstyled d-grid gap-3 mt-4">
                        <li class="d-flex gap-3"><i class="bi bi-shield-check text-primary mt-1"></i><span><strong>Policy-safe by design.</strong> The conversation continues only when the commenter replies or taps a button — their action opens the messaging window.</span></li>
                        <li class="d-flex gap-3"><i class="bi bi-funnel text-primary mt-1"></i><span><strong>Keyword targeting.</strong> Reply only to comments containing "LINK", "INFO", "PRICE" — or reply to every comment.</span></li>
                        <li class="d-flex gap-3"><i class="bi bi-graph-up text-primary mt-1"></i><span><strong>Full visibility.</strong> Track processed, skipped, duplicate and failed comment events per post.</span></li>
                    </ul>
                </div>
                <div class="col-lg-6">
                    <div class="msgr-phone">
                        <div class="msgr-screen">
                            <div class="msgr-header"><i class="bi bi-chevron-left"></i> Your Business <i class="bi bi-info-circle ms-auto"></i></div>
                            <div class="msgr-body">
                                <div class="msgr-bubble in">I want the link please 🙏</div>
                                <div class="msgr-bubble out">Hi {{ '{{first_name}}' }}! Thanks for your comment. Tap the button below to get more information.
                                    <span class="msgr-btn-row"><span class="msgr-btn">Get the details →</span></span>
                                </div>
                                <div class="msgr-bubble in">Thank you, just ordered!</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ AUTO REPLIES + SUBSCRIBERS ============ --}}
    <section class="section-pad bg-body-tertiary">
        <div class="container">
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="feature-card h-auto">
                        <span class="feature-icon"><i class="bi bi-robot"></i></span>
                        <h3 class="h4">Automatic DM replies that sound human</h3>
                        <p class="text-muted small">Set a default reply for incoming messages, then layer keyword-specific responses on top. Add quick replies and buttons, personalization variables with safe fallbacks, optional business-hours behavior, and a handoff message when a human should take over.</p>
                        <div class="chat-bubble-demo mb-2">"Hi {{ '{{first_name}}' }}! Thanks for messaging {{ '{{business_name}}' }}. What would you like help with today?"</div>
                        <div class="d-flex flex-wrap gap-2">
                            <span class="badge badge-soft-primary">Track order</span>
                            <span class="badge badge-soft-primary">Talk to sales</span>
                            <span class="badge badge-soft-primary">Opening hours</span>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="feature-card h-auto">
                        <span class="feature-icon"><i class="bi bi-people"></i></span>
                        <h3 class="h4">Subscriber management & analytics</h3>
                        <p class="text-muted small">Every interaction builds your Messenger contact list — people who messaged you or engaged through your automations. Search, filter, tag, export to CSV, and watch performance in real time.</p>
                        <div class="row g-3">
                            <div class="col-6"><div class="stat-card"><div class="stat-label">Messages sent</div><div class="stat-value">12,480</div><div class="stat-sub">last 30 days</div></div></div>
                            <div class="col-6"><div class="stat-card"><div class="stat-label">Read rate</div><div class="stat-value">87%</div><div class="stat-sub">where reported</div></div></div>
                            <div class="col-6"><div class="stat-card"><div class="stat-label">Link clicks</div><div class="stat-value">1,902</div><div class="stat-sub">first-party tracking</div></div></div>
                            <div class="col-6"><div class="stat-card"><div class="stat-label">CTR</div><div class="stat-value">14.8%</div><div class="stat-sub">unique clicks ÷ delivered</div></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ HOW IT WORKS ============ --}}
    <section class="section-pad">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="mb-2">How it works</h2>
                <p class="text-muted mb-0">Three steps, about five minutes.</p>
            </div>
            <div class="row g-4 text-center">
                <div class="col-md-4">
                    <div class="feature-card">
                        <span class="step-number mb-3">1</span>
                        <h3 class="h5">Connect your Page</h3>
                        <p class="small text-muted">Log in with Facebook using the official authorization flow. We request only the permissions needed for messaging — never your Facebook password.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="feature-card">
                        <span class="step-number mb-3">2</span>
                        <h3 class="h5">Switch on automations</h3>
                        <p class="small text-muted">Enable your welcome message, default reply, keyword rules and comment automations with friendly editors and live message previews.</p>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="feature-card">
                        <span class="step-number mb-3">3</span>
                        <h3 class="h5">Grow & measure</h3>
                        <p class="small text-muted">Contacts accumulate automatically. Run eligible broadcasts, track clicks with first-party links, and watch the analytics update.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ SECURITY ============ --}}
    <section class="section-pad bg-body-tertiary">
        <div class="container">
            <div class="row align-items-center g-5">
                <div class="col-lg-6">
                    <h2 class="mb-3">Security and the official Facebook integration</h2>
                    <p class="text-muted">Dorla integrates exclusively through the official Meta Graph API, Messenger Send API and webhook platform. Access tokens are encrypted at rest, every webhook is signature-verified, and tenant data is strictly isolated — your Pages, contacts and messages are visible only to you.</p>
                    <div class="d-flex flex-wrap gap-2 mt-3">
                        <span class="badge badge-soft-success"><i class="bi bi-lock me-1"></i>Tokens encrypted</span>
                        <span class="badge badge-soft-success"><i class="bi bi-shield-check me-1"></i>Signed webhooks</span>
                        <span class="badge badge-soft-success"><i class="bi bi-person-lock me-1"></i>Strict tenant isolation</span>
                        <span class="badge badge-soft-success"><i class="bi bi-clock-history me-1"></i>Audit logs</span>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="feature-card">
                        <h3 class="h5 mb-3"><i class="bi bi-info-circle text-primary me-2"></i>Compliance-first messaging</h3>
                        <ul class="small text-muted d-grid gap-2 mb-0">
                            <li><i class="bi bi-check2 text-success me-2"></i>Standard 24-hour messaging window enforced before every send</li>
                            <li><i class="bi bi-check2 text-success me-2"></i>Message tags only where Meta policy permits, with recorded opt-ins</li>
                            <li><i class="bi bi-check2 text-success me-2"></i>One private reply per comment, inside the allowed window</li>
                            <li><i class="bi bi-check2 text-success me-2"></i>Ineligible broadcast recipients are skipped — never forced</li>
                            <li><i class="bi bi-check2 text-success me-2"></i>Data deletion requests honored end-to-end</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- ============ PRICING ============ --}}
    <section class="section-pad" id="pricing">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="mb-2">Simple pricing that grows with you</h2>
                <p class="text-muted mb-0">Start free. Upgrade when your automations are earning their keep. Plans are configured by the platform administrator.</p>
            </div>
            <div class="row g-4 justify-content-center">
                @forelse ($plans as $key => $plan)
                    <div class="col-md-6 col-lg-4">
                        <div class="price-card {{ $key === 'growth' ? 'popular' : '' }}">
                            @if ($key === 'growth')<span class="badge bg-primary popular-tag">Most popular</span>@endif
                            <h3 class="h5 mb-1">{{ $plan['name'] }}</h3>
                            <div class="d-flex align-items-end gap-2 mb-3">
                                <span class="price-amount">${{ number_format($plan['price_monthly']) }}</span>
                                <span class="text-muted small mb-2">/month</span>
                            </div>
                            <ul class="list-unstyled small d-grid gap-2 mb-4">
                                <li><i class="bi bi-flag me-2 text-primary"></i>{{ $plan['max_pages'] }} connected {{ Str::plural('Page', $plan['max_pages']) }}</li>
                                <li><i class="bi bi-people me-2 text-primary"></i>{{ number_format($plan['max_contacts']) }} contacts</li>
                                <li><i class="bi bi-lightning-charge me-2 text-primary"></i>{{ $plan['max_automations'] }} automations</li>
                                <li><i class="bi bi-megaphone me-2 text-primary"></i>{{ $plan['max_broadcasts_per_month'] }} broadcasts / month</li>
                                @foreach ($plan['features'] ?? [] as $feature)
                                    <li><i class="bi bi-check2 me-2 text-success"></i>{{ $feature }}</li>
                                @endforeach
                            </ul>
                            <a href="{{ route('register') }}" class="btn {{ $key === 'growth' ? 'btn-primary' : 'btn-light' }} w-100">
                                {{ ($plan['price_monthly'] ?? 0) > 0 ? 'Start with '.$plan['name'] : 'Start free' }}
                            </a>
                        </div>
                    </div>
                @empty
                    <div class="col-lg-4"><div class="price-card"><h3 class="h5">Free</h3><div class="price-amount">$0</div><p class="small text-muted">Pricing plans will be announced soon — register now and lock in early access.</p><a href="{{ route('register') }}" class="btn btn-primary w-100">Create account</a></div></div>
                @endforelse
            </div>
            <p class="text-center small text-muted mt-4 mb-0">Subscription fees cover the Dorla platform only. Facebook, Messenger and Meta services are provided by Meta under their own terms.</p>
        </div>
    </section>

    {{-- ============ FAQ ============ --}}
    <section class="section-pad bg-body-tertiary" id="faq">
        <div class="container" style="max-width: 48rem">
            <div class="text-center mb-4">
                <h2 class="mb-2">Frequently asked questions</h2>
            </div>
            <div class="accordion faq-accordion" id="faqAccordion">
                @foreach ($faqs as $i => $faq)
                    <div class="accordion-item">
                        <h3 class="accordion-header">
                            <button class="accordion-button {{ $i !== 0 ? 'collapsed' : '' }}" type="button" data-bs-toggle="collapse" data-bs-target="#faq{{ $i }}">
                                {{ $faq['q'] }}
                            </button>
                        </h3>
                        <div id="faq{{ $i }}" class="accordion-collapse collapse {{ $i === 0 ? 'show' : '' }}" data-bs-parent="#faqAccordion">
                            <div class="accordion-body small text-muted">{{ $faq['a'] }}</div>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>
    </section>

    {{-- ============ CTA ============ --}}
    <section class="py-5">
        <div class="container">
            <div class="feature-card text-center py-5" style="background: linear-gradient(135deg, var(--dorla-blue-soft), #fff)">
                <h2 class="mb-2">Ready to answer every message first?</h2>
                <p class="text-muted mb-4">Create your free account and connect your first Page in minutes.</p>
                <a href="{{ route('register') }}" class="btn btn-primary btn-lg px-4">Create your free account</a>
            </div>
        </div>
    </section>
@endsection
