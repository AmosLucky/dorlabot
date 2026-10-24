@extends('layouts.public')
@section('title', 'Log in')
@section('content')
<div class="auth-shell">
    <div class="auth-side">
        <h2 class="text-white mb-3" style="letter-spacing:-.02em">Welcome back.</h2>
        <p class="mb-4" style="color:#c6d0e2">Your automations have been busy. See who messaged, what was delivered, and how your campaigns performed.</p>
        <div class="d-flex flex-column gap-3" style="max-width:26rem">
            <div class="chat-bubble-demo" style="background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15);color:#d6dfef"><strong>Comment automation</strong> · 42 private replies sent today</div>
            <div class="chat-bubble-demo out" style="background:#1667d9"><strong>Broadcast "October promo"</strong> · 87% delivered, CTR 11.4%</div>
        </div>
    </div>
    <div class="auth-card">
        <form method="POST" action="{{ route('login.store') }}">
            @csrf
            <h1 class="h3 mb-1">Log in</h1>
            <p class="text-muted small mb-4">Welcome back! Enter your details to continue.</p>
            @include('partials.errors')
            <div class="mb-3">
                <label class="form-label" for="email">Email address</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus class="form-control @error('email') is-invalid @enderror" placeholder="you@company.com">
                @error('email')<div class="invalid-feedback">{{ $message }}</div>@enderror
            </div>
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <label class="form-label" for="password">Password</label>
                    <a href="{{ route('password.request') }}" class="small">Forgot password?</a>
                </div>
                <input id="password" type="password" name="password" required class="form-control @error('password') is-invalid @enderror">
                @error('password')<div class="invalid-feedback">{{ $message }}</div>@enderror
            </div>
            <div class="form-check mb-4">
                <input class="form-check-input" type="checkbox" name="remember" id="remember">
                <label class="form-check-label small" for="remember">Keep me signed in</label>
            </div>
            <button class="btn btn-primary w-100 mb-3">Log in</button>
            <p class="text-center small text-muted mb-0">New here? <a href="{{ route('register') }}">Create a free account</a></p>
        </form>
    </div>
</div>
@endsection
