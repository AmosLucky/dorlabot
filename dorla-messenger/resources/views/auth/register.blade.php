@extends('layouts.public')
@section('title', 'Create your account')
@section('content')
<div class="auth-shell">
    <div class="auth-side">
        <h2 class="text-white mb-3" style="letter-spacing:-.02em">Answer first. Every time.</h2>
        <p class="mb-4" style="color:#c6d0e2">Join businesses automating welcome messages, comment replies and broadcasts on Facebook Messenger.</p>
        <ul class="list-unstyled d-grid gap-3 small" style="color:#d6dfef;max-width:26rem">
            <li><i class="bi bi-check-circle me-2"></i>Official Meta Messenger Platform integration</li>
            <li><i class="bi bi-check-circle me-2"></i>Personalized with names, page and business variables</li>
            <li><i class="bi bi-check-circle me-2"></i>Policy-safe: messaging windows enforced automatically</li>
            <li><i class="bi bi-check-circle me-2"></i>Free plan to get started</li>
        </ul>
    </div>
    <div class="auth-card">
        <form method="POST" action="{{ route('register.store') }}">
            @csrf
            <h1 class="h3 mb-1">Create your account</h1>
            <p class="text-muted small mb-4">Start automating Messenger in minutes.</p>
            @include('partials.errors')
            <div class="mb-3">
                <label class="form-label" for="name">Full name</label>
                <input id="name" name="name" value="{{ old('name') }}" required autofocus class="form-control @error('name') is-invalid @enderror">
                @error('name')<div class="invalid-feedback">{{ $message }}</div>@enderror
            </div>
            <div class="mb-3">
                <label class="form-label" for="email">Email address</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" required class="form-control @error('email') is-invalid @enderror">
                @error('email')<div class="invalid-feedback">{{ $message }}</div>@enderror
            </div>
            <div class="mb-3">
                <label class="form-label" for="password">Password</label>
                <input id="password" type="password" name="password" required class="form-control @error('password') is-invalid @enderror">
                <div class="form-text">At least 8 characters.</div>
                @error('password')<div class="invalid-feedback">{{ $message }}</div>@enderror
            </div>
            <div class="mb-3">
                <label class="form-label" for="password_confirmation">Confirm password</label>
                <input id="password_confirmation" type="password" name="password_confirmation" required class="form-control">
            </div>
            <div class="form-check mb-4">
                <input class="form-check-input" type="checkbox" name="terms" id="terms" value="1" @checked(old('terms'))>
                <label class="form-check-label small" for="terms">I agree to the <a href="{{ route('terms') }}">Terms of Service</a> and <a href="{{ route('privacy') }}">Privacy Policy</a></label>
            </div>
            <button class="btn btn-primary w-100 mb-3">Create account</button>
            <p class="text-center small text-muted mb-0">Already have an account? <a href="{{ route('login') }}">Log in</a></p>
        </form>
    </div>
</div>
@endsection
