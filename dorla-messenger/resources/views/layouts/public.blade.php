<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Automate Facebook Messenger Conversations') — {{ config('app.name') }}</title>
    <meta name="description" content="@yield('meta_description', 'Automate Facebook Messenger replies, welcome messages, comment-to-DM responses and eligible broadcasts — personalized and policy-safe.')">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='4' fill='%231667d9'/><path d='M3.5 7.8 8 3.8l4.5 4-2 .02V12H9V9H7v3H5.5V7.8z' fill='white'/></svg>">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('css/dorla.css') }}">
</head>
<body class="d-flex flex-column min-vh-100 bg-white">
<div id="toastStack" class="toast-stack"></div>

<nav class="navbar navbar-expand-lg dorla-navbar sticky-top">
    <div class="container">
        <a class="navbar-brand d-flex align-items-center" href="{{ route('home') }}">
            <span class="brand-badge"><i class="bi bi-send-fill"></i></span>{{ config('app.name') }}
        </a>
        <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#publicNav" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="publicNav">
            <ul class="navbar-nav mx-auto">
                <li class="nav-item"><a class="nav-link" href="{{ route('home') }}">Features</a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('pricing') }}">Pricing</a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('about') }}">About</a></li>
                <li class="nav-item"><a class="nav-link" href="{{ route('contact') }}">Contact</a></li>
            </ul>
            <div class="d-flex gap-2 mt-3 mt-lg-0">
                @auth
                    <a href="{{ route('dashboard') }}" class="btn btn-primary px-3">Open dashboard</a>
                @endauth
                @guest
                    <a href="{{ route('login') }}" class="btn btn-light px-3">Log in</a>
                    <a href="{{ route('register') }}" class="btn btn-primary px-3">Start free</a>
                @endguest
            </div>
        </div>
    </div>
</nav>

<main class="flex-grow-1">
    @yield('content')
</main>

<footer class="dorla-footer mt-auto pt-5 pb-4">
    <div class="container">
        <div class="row g-4">
            <div class="col-lg-4">
                <h5 class="text-white d-flex align-items-center mb-3">
                    <span class="brand-badge"><i class="bi bi-send-fill"></i></span>{{ config('app.name') }}
                </h5>
                <p class="small mb-0">Automate Facebook Messenger conversations with the official Meta Messenger Platform. Built for small businesses that want faster replies without losing the personal touch.</p>
            </div>
            <div class="col-6 col-lg-2">
                <h6 class="footer-heading">Product</h6>
                <ul class="list-unstyled small d-grid gap-2">
                    <li><a href="{{ route('home') }}">Features</a></li>
                    <li><a href="{{ route('pricing') }}">Pricing</a></li>
                    <li><a href="{{ route('about') }}">About</a></li>
                    <li><a href="{{ route('contact') }}">Contact</a></li>
                </ul>
            </div>
            <div class="col-6 col-lg-2">
                <h6 class="footer-heading">Legal</h6>
                <ul class="list-unstyled small d-grid gap-2">
                    <li><a href="{{ route('privacy') }}">Privacy policy</a></li>
                    <li><a href="{{ route('terms') }}">Terms of service</a></li>
                    <li><a href="{{ route('data-deletion') }}">Data deletion</a></li>
                </ul>
            </div>
            <div class="col-lg-4">
                <h6 class="footer-heading">Compliance note</h6>
                <p class="small mb-2">This platform uses the official Meta Graph API and Messenger Platform. All messaging follows Meta's rules, including the 24-hour standard messaging window.</p>
                <p class="small mb-0 opacity-75">Not endorsed by or affiliated with Meta. Facebook and Messenger are trademarks of Meta Platforms, Inc.</p>
            </div>
        </div>
        <hr class="border-secondary opacity-25 my-4">
        <div class="d-flex flex-wrap justify-content-between small">
            <span>&copy; {{ now()->year }} {{ config('app.name') }} — dorlacode.com</span>
            <span>All messaging is subject to Meta Platform Terms.</span>
        </div>
    </div>
</footer>

<script src="{{ asset('assets/vendor/js/bootstrap.bundle.min.js') }}"></script>
<script src="{{ asset('js/dorla.js') }}"></script>
@stack('scripts')
</body>
</html>
