@extends('layouts.public')
@section('title', 'Reset password')
@section('content')
<div class="auth-shell">
    <div class="auth-side"><h2 class="text-white mb-3">Choose a new password</h2><p style="color:#c6d0e2">Pick something strong you don't use anywhere else.</p></div>
    <div class="auth-card">
        <form method="POST" action="{{ route('password.update') }}">
            @csrf
            <h1 class="h3 mb-1">Reset your password</h1>
            <p class="text-muted small mb-4">Enter your email and a new password.</p>
            @include('partials.errors')
            <input type="hidden" name="token" value="{{ $request->route('token') ?? $request->token }}">
            <div class="mb-3">
                <label class="form-label" for="email">Email address</label>
                <input id="email" type="email" name="email" value="{{ old('email', $request->email) }}" required class="form-control">
            </div>
            <div class="mb-3">
                <label class="form-label" for="password">New password</label>
                <input id="password" type="password" name="password" required class="form-control">
            </div>
            <div class="mb-4">
                <label class="form-label" for="password_confirmation">Confirm new password</label>
                <input id="password_confirmation" type="password" name="password_confirmation" required class="form-control">
            </div>
            <button class="btn btn-primary w-100 mb-3">Update password</button>
            <p class="text-center small text-muted mb-0"><a href="{{ route('login') }}">Back to login</a></p>
        </form>
    </div>
</div>
@endsection
