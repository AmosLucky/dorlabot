@props(['status', 'map' => []])
@php
    $classMap = array_merge([
        'active' => 'badge-soft-success', 'connected' => 'badge-soft-success', 'sent' => 'badge-soft-primary',
        'delivered' => 'badge-soft-success', 'read' => 'badge-soft-success', 'clicked' => 'badge-soft-success',
        'completed' => 'badge-soft-success', 'processed' => 'badge-soft-success',
        'pending' => 'badge-soft-warning', 'scheduled' => 'badge-soft-primary', 'queued' => 'badge-soft-primary',
        'sending' => 'badge-soft-primary', 'paused' => 'badge-soft-warning', 'needs_reconnect' => 'badge-soft-warning',
        'draft' => 'badge-soft-secondary', 'skipped' => 'badge-soft-secondary', 'duplicate' => 'badge-soft-secondary', 'duplicated' => 'badge-soft-secondary',
        'suspended' => 'badge-soft-danger', 'failed' => 'badge-soft-danger', 'disabled' => 'badge-soft-danger', 'cancelled' => 'badge-soft-danger', 'rejected' => 'badge-soft-danger', 'received' => 'badge-soft-primary',
    ], $map);
    $label = str($status)->replace('_', ' ')->title();
@endphp
<span class="badge {{ $classMap[$status] ?? 'badge-soft-secondary' }}" {{ $attributes }}>{{ $label }}</span>
