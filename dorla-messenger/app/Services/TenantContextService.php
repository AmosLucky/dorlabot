<?php

namespace App\Services;

use App\Models\User;

/**
 * Helpers for strict tenant isolation.
 *
 * Every tenant-owned query in the platform MUST be scoped by user_id.
 * Controllers use this service (in addition to Policies) to build the
 * baseline ownership scope; the ownership user id always comes from
 * the authenticated user, never from request input.
 */
class TenantContextService
{
    public function currentUserId(): ?int
    {
        return auth()->id();
    }

    /**
     * Assert the given page belongs to the currently authenticated tenant.
     */
    public function ownsPage(User $user, \App\Models\FacebookPage $page): bool
    {
        return (int) $page->user_id === (int) $user->id;
    }

    /**
     * Abort when the page is not owned by the current user.
     */
    public function authorizePage(User $user, \App\Models\FacebookPage $page): void
    {
        if (! $this->ownsPage($user, $page)) {
            abort(404);
        }
    }
}
