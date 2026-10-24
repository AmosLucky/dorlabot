@if (! $metaConfigured)
    <div class="config-warning d-flex gap-3 mb-4">
        <i class="bi bi-gear-fill fs-4 text-warning"></i>
        <div>
            <strong class="d-block text-warning-emphasis">Meta credentials not configured — live Facebook features are disabled</strong>
            <p class="small mb-2">The application is running with placeholder credentials. Nothing is being sent to Meta and no Page connections are possible until real credentials are added to <code>.env</code>. This is expected behavior — non-Facebook features work normally.</p>
            <ul class="small mb-2 ps-3">
                @foreach ($metaMissingItems ?? [] as $item)
                    <li>{{ $item }}</li>
                @endforeach
            </ul>
            <p class="small mb-0">Setup guide: <code>docs/META_APP_SETUP.md</code> in the project. After editing <code>.env</code>, run <code>php artisan config:clear</code>.</p>
        </div>
    </div>
@endif
