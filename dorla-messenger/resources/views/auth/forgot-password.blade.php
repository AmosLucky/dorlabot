@extends('layouts.public')
@section('title', 'Forgot password')
@section('content')
<div class="auth-shell">
    <div class="auth-side"><h2 class="text-white mb-3">Password reset</h2><p style="color:#c6d0e2">Enter your email and we will send a secure reset link.</p></div>
    <div class="auth-card">
        <form method="POST" action="{{ route('password.email') }}">
            @csrf
            <h1 class="h3 mb-1">Forgot your password?</h1>
            <p class="text-muted small mb-4">No problem — enter your email and we'll send you a reset link.</p>
            @include('partials.errors')
            <div class="mb-3">
                <label class="form-label" for="email">Email address</label>
                <input id="email" type="email" name="email" value="{{ old('email') }}" required autofocus class="form-control">
            </div>
            <button class="btn btn-primary w-100 mb-3">Email reset link</button>
            <p class="text-center small text-muted mb-0"><a href="{{ route('login') }}">Back to login</a></p>
        </form>
    </div>
</div>
@endsection
