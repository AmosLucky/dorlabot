<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrackedLink extends Model
{
    protected $fillable = [
        'user_id', 'facebook_page_id', 'broadcast_id', 'automation_rule_id',
        'tracking_code', 'destination_url', 'label',
        'clicks_count', 'unique_clicks_count',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(Broadcast::class);
    }

    public function clicks(): HasMany
    {
        return $this->hasMany(LinkClickEvent::class);
    }

    public function trackingUrl(): string
    {
        return rtrim(config('meta.app_url'), '/').'/c/'.$this->tracking_code;
    }
}
