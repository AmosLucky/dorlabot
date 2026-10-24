<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IntegrationLog extends Model
{
    protected $fillable = [
        'user_id', 'facebook_page_id', 'channel', 'operation',
        'level', 'message', 'context',
    ];

    protected function casts(): array
    {
        return ['context' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class);
    }

    public function levelBadgeClass(): string
    {
        return match ($this->level) {
            'error' => 'danger',
            'warning' => 'warning text-dark',
            default => 'secondary',
        };
    }
}
