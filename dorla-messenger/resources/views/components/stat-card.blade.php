@props(['label', 'value', 'icon' => 'bi-graph-up', 'color' => 'blue', 'sub' => null])
<div class="stat-card" {{ $attributes }}>
    <div class="d-flex justify-content-between align-items-start">
        <div>
            <div class="stat-label">{{ $label }}</div>
            <div class="stat-value">{{ $value }}</div>
            @if ($sub)<div class="stat-sub">{{ $sub }}</div>@endif
        </div>
        <span class="stat-icon {{ $color }}"><i class="bi {{ $icon }}"></i></span>
    </div>
</div>
