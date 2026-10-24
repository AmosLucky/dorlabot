{{-- Flash messages rendered as toasts by dorla.js --}}
@if (session('success'))<div class="d-none" data-flash="success">{{ session('success') }}</div>@endif
@if (session('error'))<div class="d-none" data-flash="error">{{ session('error') }}</div>@endif
@if (session('warning'))<div class="d-none" data-flash="warning">{{ session('warning') }}</div>@endif
@if (session('info'))<div class="d-none" data-flash="info">{{ session('info') }}</div>@endif
