@extends('layouts.public')
@section('title', 'Verify your email')
@section('content')
<div class="auth-shell">
    <div class="auth-side"><h2 class="text-white mb-3">Almost there</h2><p style="color:#c6d0e2">Verification keeps your account secure and enables password recovery.</p></div>
    <div class="auth-card">
        <div class="text-center">
            <span class="feature-icon mx-auto" style="width:64px;height:64px;font-size:1.8rem"><i class="bi bi-envelope-check"></i></span>
            <h1 class="h3 mb-2 mt-3">Verify your email address</h1>
            <p class="text-muted small mb-4">We sent a verification link to <strong>{{ auth()->user()->email }}</strong>. Click it to activate your dashboard. Didn't get it? Check spam or resend below.</p>
            @include('partials.errors')
            <form method="POST" action="{{ route('verification.send') }}" class="d-grid gap-2">
                @csrf
                <button class="btn btn-primary">Resend verification email</button>
            </form>
            <form method="POST" action="{{ route('logout') }}" class="mt-2">
                @csrf
                <button class="btn btn-light w-100">Log out</button>
            </form>
        </div>
    </div>
</div>
@endsection
