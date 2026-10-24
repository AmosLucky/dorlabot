<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LinkClickEvent extends Model
{
    protected $fillable = [
        'tracked_link_id', 'user_id', 'messenger_contact_id', 'recipient_psid',
        'ip_hash', 'user_agent', 'referer', 'clicked_at',
    ];

    protected function casts(): array
    {
        return ['clicked_at' => 'datetime'];
    }

    public function trackedLink(): BelongsTo
    {
        return $this->belongsTo(TrackedLink::class);
    }
}
