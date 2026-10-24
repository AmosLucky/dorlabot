<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'Admin') — {{ config('app.name') }}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='4' fill='%2316243d'/><path d='M8 3 4.5 4.8v2.7c0 2.2 1.5 4.1 3.5 4.6 2-.5 3.5-2.4 3.5-4.6V4.8z' fill='white'/></svg>">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap.min.css') }}">
    <link rel="stylesheet" href="{{ asset('assets/vendor/css/bootstrap-icons.min.css') }}">
    <link rel="stylesheet" href="{{ asset('css/dorla.css') }}">
</head>
<body>
<div id="toastStack" class="toast-stack"></div>
@include('partials.flash')

<div class="app-shell d-flex">
    <aside class="app-sidebar" id="appSidebar">
        <a href="{{ route('admin.dashboard') }}" class="brand">
            <span class="brand-badge" style="background:linear-gradient(135deg,#16243d,#3c4a63)"><i class="bi bi-shield-lock-fill"></i></span>
            Admin console
        </a>
        <nav class="pb-4" aria-label="Admin navigation">
            <div class="nav-label">Platform</div>
            <div class="nav-item"><a href="{{ route('admin.dashboard') }}" class="nav-link {{ request()->routeIs('admin.dashboard') ? 'active' : '' }}"><i class="bi bi-speedometer2"></i> Dashboard</a></div>
            <div class="nav-item"><a href="{{ route('admin.users.index') }}" class="nav-link {{ request()->routeIs('admin.users.*') ? 'active' : '' }}"><i class="bi bi-people"></i> Users</a></div>
            <div class="nav-item"><a href="{{ route('admin.pages.index') }}" class="nav-link {{ request()->routeIs('admin.pages.*') ? 'active' : '' }}"><i class="bi bi-flag"></i> Connected pages</a></div>

            <div class="nav-label">System</div>
            <div class="nav-item"><a href="{{ route('admin.settings.edit') }}" class="nav-link {{ request()->routeIs('admin.settings.*') ? 'active' : '' }}"><i class="bi bi-sliders"></i> Platform settings</a></div>
            <div class="nav-item"><a href="{{ route('admin.logs') }}" class="nav-link {{ request()->routeIs('admin.logs') ? 'active' : '' }}"><i class="bi bi-journal-text"></i> Integration logs</a></div>
            <div class="nav-item"><a href="{{ route('admin.failed-jobs') }}" class="nav-link {{ request()->routeIs('admin.failed-jobs') ? 'active' : '' }}"><i class="bi bi-exclamation-octagon"></i> Failed jobs</a></div>
            <div class="nav-item"><a href="{{ route('admin.deletion-requests.index') }}" class="nav-link {{ request()->routeIs('admin.deletion-requests.*') ? 'active' : '' }}"><i class="bi bi-trash3"></i> Deletion requests</a></div>

            <div class="nav-label">Customer view</div>
            <div class="nav-item"><a href="{{ route('dashboard') }}" class="nav-link"><i class="bi bi-box-arrow-in-right"></i> My dashboard</a></div>
        </nav>
    </aside>

    <div class="flex-grow-1 d-flex flex-column min-vw-0">
        <header class="app-topbar d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-2">
                <button id="sidebarToggle" class="btn btn-light btn-sm d-lg-none" aria-label="Toggle sidebar"><i class="bi bi-list fs-5"></i></button>
                <h1 class="h5 mb-0">@yield('page_title', 'Platform administration')</h1>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="badge badge-soft-secondary"><i class="bi bi-shield-check me-1"></i>Super admin</span>
                <button id="themeToggle" class="btn btn-light btn-sm" aria-label="Toggle theme"><i class="bi bi-moon-stars"></i></button>
                <div class="dropdown">
                    <button class="btn btn-light btn-sm d-flex align-items-center gap-2" data-bs-toggle="dropdown" aria-expanded="false">
                        <span class="avatar avatar-initials avatar-sm rounded-circle">{{ substr(auth()->user()->name, 0, 1) }}</span>
                        <span class="d-none d-md-inline small fw-semibold">{{ Str::before(auth()->user()->name, ' ') }}</span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="{{ route('settings.profile') }}"><i class="bi bi-person me-2"></i>My profile</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><form method="POST" action="{{ route('logout') }}">@csrf<button class="dropdown-item" type="submit"><i class="bi bi-box-arrow-right me-2"></i>Log out</button></form></li>
                    </ul>
                </div>
            </div>
        </header>

        <main class="p-3 p-lg-4 flex-grow-1 min-vw-0">
            @include('partials.meta-config-warning')
            @include('partials.errors')
            @yield('content')
        </main>
    </div>
</div>

<script src="{{ asset('assets/vendor/js/bootstrap.bundle.min.js') }}"></script>
<script src="{{ asset('assets/vendor/js/chart.umd.min.js') }}"></script>
<script src="{{ asset('js/dorla.js') }}"></script>
@stack('scripts')
</body>
</html>
