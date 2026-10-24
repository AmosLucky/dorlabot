<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Broadcast extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_QUEUED = 'queued';
    public const STATUS_SENDING = 'sending';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id', 'facebook_page_id', 'name', 'message_text', 'buttons',
        'message_tag', 'status', 'tag_filter', 'audience_description',
        'estimated_recipients', 'eligible_recipients', 'skipped_recipients',
        'scheduled_at', 'started_at', 'completed_at',
        'sent_count', 'delivered_count', 'read_count', 'clicked_count', 'failed_count',
    ];

    protected function casts(): array
    {
        return [
            'buttons' => 'array',
            'tag_filter' => 'array',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(BroadcastRecipient::class);
    }

    public function trackedLinks(): HasMany
    {
        return $this->hasMany(TrackedLink::class);
    }

    public function ctr(): float
    {
        // CTR = unique recipients who clicked / delivered messages x 100
        return $this->delivered_count > 0
            ? round(($this->clicked_count / $this->delivered_count) * 100, 2)
            : 0.0;
    }

    public function statusBadgeClass(): string
    {
        return match ($this->status) {
            self::STATUS_DRAFT => 'secondary',
            self::STATUS_SCHEDULED => 'info',
            self::STATUS_QUEUED, self::STATUS_SENDING => 'primary',
            self::STATUS_PAUSED => 'warning',
            self::STATUS_COMPLETED => 'success',
            self::STATUS_CANCELLED, self::STATUS_FAILED => 'danger',
            default => 'secondary',
        };
    }
}
