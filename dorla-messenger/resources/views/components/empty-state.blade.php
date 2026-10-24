@props(['icon' => 'bi-inbox', 'title', 'ctaHref' => null, 'ctaText' => null])
<div class="empty-state" {{ $attributes }}>
    <span class="empty-icon"><i class="bi {{ $icon }}"></i></span>
    <h6>{{ $title }}</h6>
    <p class="small">{{ $slot }}</p>
    @if ($ctaHref)
        <a href="{{ $ctaHref }}" class="btn btn-primary btn-sm mt-1">{{ $ctaText ?? 'Get started' }}</a>
    @endif
</div>
