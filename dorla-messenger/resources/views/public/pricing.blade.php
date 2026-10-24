@extends('layouts.public')
@section('title', 'Pricing')
@section('content')
<section class="hero-wrap"><div class="container py-5 text-center">
    <h1 class="font-hero mb-3">Pricing</h1>
    <p class="font-sub-hero mx-auto" style="max-width: 40rem">Plans are configured by the platform administrator and shown here exactly as set. Start free, upgrade any time.</p>
</div></section>
<section class="section-pad pt-4"><div class="container">
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
                    <a href="{{ route('register') }}" class="btn {{ $key === 'growth' ? 'btn-primary' : 'btn-light' }} w-100">Get started</a>
                </div>
            </div>
        @empty
            <div class="col-lg-5"><div class="price-card text-center"><h3 class="h5">Free early access</h3><div class="price-amount">$0</div><p class="small text-muted">Paid plans will be announced soon. Register now to lock in early access.</p><a href="{{ route('register') }}" class="btn btn-primary w-100">Create account</a></div></div>
        @endforelse
    </div>
    <p class="text-center small text-muted mt-4 mb-0">Subscription fees cover the Dorla platform only — Meta services are governed by Meta's own terms.</p>
</div></section>
@endsection
