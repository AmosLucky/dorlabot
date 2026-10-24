<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Dashboard') — {{ config('app.name') }}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='4' fill='%231667d9'/><path d='M3.5 7.8 8 3.8l4.5 4-2 .02V12H9V9H7v3H5.5V7.8z' fill='white'/></svg>">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('css/dorla.css') }}">
</head>
<body>
<div id="toastStack" class="toast-stack"></div>
@include('partials.flash')

<div class="app-shell d-flex">
    <aside class="app-sidebar" id="appSidebar">
        <a href="{{ route('dashboard') }}" class="brand">
            <span class="brand-badge"><i class="bi bi-send-fill"></i></span>{{ config('app.name') }}
        </a>
        <nav class="pb-4" aria-label="Main navigation">
            <div class="nav-label">Overview</div>
            <div class="nav-item"><a href="{{ route('dashboard') }}" class="nav-link {{ request()->routeIs('dashboard') ? 'active' : '' }}"><i class="bi bi-grid-1x2"></i> Dashboard</a></div>
            <div class="nav-item"><a href="{{ route('analytics') }}" class="nav-link {{ request()->routeIs('analytics') ? 'active' : '' }}"><i class="bi bi-graph-up-arrow"></i> Analytics</a></div>

            <div class="nav-label">Facebook Pages</div>
            <div class="nav-item"><a href="{{ route('pages.index') }}" class="nav-link {{ request()->routeIs('pages.*') ? 'active' : '' }}"><i class="bi bi-flag"></i> Connected pages</a></div>
            <div class="nav-item"><a href="{{ route('contacts.index') }}" class="nav-link {{ request()->routeIs('contacts.*') ? 'active' : '' }}"><i class="bi bi-people"></i> Contacts</a></div>

            <div class="nav-label">Automations</div>
            <div class="nav-item"><a href="{{ route('automations.index') }}" class="nav-link {{ request()->routeIs('automations.*') ? 'active' : '' }}"><i class="bi bi-lightning-charge"></i> Reply automations</a></div>
            <div class="nav-item"><a href="{{ route('comment-automations.index') }}" class="nav-link {{ request()->routeIs('comment-automations.*') ? 'active' : '' }}"><i class="bi bi-chat-dots"></i> Comment automation</a></div>

            <div class="nav-label">Messaging</div>
            <div class="nav-item"><a href="{{ route('broadcasts.index') }}" class="nav-link {{ request()->routeIs('broadcasts.*') ? 'active' : '' }}"><i class="bi bi-megaphone"></i> Broadcasts</a></div>

            @if ($simulationMode)
                <div class="nav-label">Development</div>
                <div class="nav-item"><a href="{{ route('simulator.index') }}" class="nav-link {{ request()->routeIs('simulator.*') ? 'active' : '' }}"><i class="bi bi-bug"></i> Event simulator</a></div>
            @endif

            <div class="nav-label">Account</div>
            <div class="nav-item"><a href="{{ route('settings.profile') }}" class="nav-link {{ request()->routeIs('settings.*') ? 'active' : '' }}"><i class="bi bi-gear"></i> Settings</a></div>
            @if (auth()->user()?->isSuperAdmin())
                <div class="nav-item"><a href="{{ route('admin.dashboard') }}" class="nav-link {{ request()->routeIs('admin.*') ? 'active' : '' }}"><i class="bi bi-shield-lock"></i> Super admin</a></div>
            @endif
        </nav>
    </aside>

    <div class="flex-grow-1 d-flex flex-column min-vw-0">
        <header class="app-topbar d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-2">
                <button id="sidebarToggle" class="btn btn-light btn-sm d-lg-none" aria-label="Toggle sidebar"><i class="bi bi-list fs-5"></i></button>
                <div>
                    <h1 class="h5 mb-0">@yield('page_title', 'Dashboard')</h1>
                    @hasSection('page_subtitle')<div class="text-muted small">{{ yield('page_subtitle') }}</div>@endif
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                @if ($simulationMode)
                    <span class="badge badge-sim"><i class="bi bi-bug me-1"></i>Simulation mode</span>
                @endif
                <button id="themeToggle" class="btn btn-light btn-sm" aria-label="Toggle theme"><i class="bi bi-moon-stars"></i></button>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-expanded="false">
                        <span class="avatar avatar-initials avatar-sm rounded-circle">{{ substr(auth()->user()->name, 0, 1) }}</span>
                        <span class="d-none d-md-inline small fw-semibold">{{ Str::before(auth()->user()->name, ' ') }}</span>
                        <i class="bi bi-chevron-down small"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="{{ route('settings.profile') }}"><i class="bi bi-person me-2"></i>Profile</a></li>
                        <li><a class="dropdown-item" href="{{ route('settings.business') }}"><i class="bi bi-building me-2"></i>Business settings</a></li>
                        <li><a class="dropdown-item" href="{{ route('settings.data-deletion') }}"><i class="bi bi-trash3 me-2"></i>Data & deletion</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <form method="POST" action="{{ route('logout') }}">@csrf
                                <button class="dropdown-item" type="submit"><i class="bi bi-box-arrow-right me-2"></i>Log out</button>
                            </form>
                        </li>
                    </ul>
                </div>
            </div>
        </header>

        <main class="p-3 p-lg-4 flex-grow-1 min-vw-0">
            @include('partials.meta-config-warning')
            @include('partials.errors')
            @yield('content')
        </main>

        <footer class="text-center text-muted small py-3 border-top">
            {{ config('app.name') }} · All messaging follows Meta Platform rules · <a href="{{ route('privacy') }}">Privacy</a> · <a href="{{ route('terms') }}">Terms</a>
        </footer>
    </div>
</div>

<script src="{{ asset('assets/vendor/js/bootstrap.bundle.min.js') }}"></script>
<script src="{{ asset('assets/vendor/js/chart.umd.min.js') }}"></script>
<script src="{{ asset('js/dorla.js') }}"></script>
@stack('scripts')
</body>
</html>
