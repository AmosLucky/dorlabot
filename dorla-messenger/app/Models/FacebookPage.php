<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FacebookPage extends Model
{
    public const STATUS_CONNECTED = 'connected';
    public const STATUS_NEEDS_RECONNECT = 'needs_reconnect';
    public const STATUS_DISABLED = 'disabled';

    protected $fillable = [
        'user_id', 'meta_page_id', 'name', 'profile_image_url',
        'access_token_encrypted', 'token_type', 'granted_permissions',
        'status', 'status_message', 'webhook_subscribed', 'webhook_subscribed_at',
        'last_checked_at', 'connected_at',
    ];

    protected function casts(): array
    {
        return [
            'access_token_encrypted' => 'encrypted',   // at-rest encryption (APP_KEY)
            'granted_permissions' => 'array',
            'webhook_subscribed' => 'boolean',
            'webhook_subscribed_at' => 'datetime',
            'last_checked_at' => 'datetime',
            'connected_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(FacebookPagePermission::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(MessengerContact::class);
    }

    public function automations(): HasMany
    {
        return $this->hasMany(AutomationRule::class);
    }

    public function broadcasts(): HasMany
    {
        return $this->hasMany(Broadcast::class);
    }

    public function commentEvents(): HasMany
    {
        return $this->hasMany(CommentEvent::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function isHealthy(): bool
    {
        return $this->status === self::STATUS_CONNECTED && $this->access_token_encrypted !== null;
    }

    public function isConfiguredForMessaging(): bool
    {
        return $this->isHealthy()
            && $this->webhook_subscribed
            && in_array('pages_messaging', $this->granted_permissions ?? [], true);
    }

    public function statusBadgeClass(): string
    {
        return match ($this->status) {
            self::STATUS_CONNECTED => 'success',
            self::STATUS_NEEDS_RECONNECT => 'warning',
            default => 'secondary',
        };
    }
}
