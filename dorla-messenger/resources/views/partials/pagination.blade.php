@if ($paginator->hasPages())
    <nav class="mt-3 d-flex justify-content-center" aria-label="Pagination">
        {{ $paginator->onEachSide(1)->links() }}
    </nav>
@endif
