<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebhookEvent extends Model
{
    public const STATUS_RECEIVED = 'received';
    public const STATUS_PROCESSED = 'processed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DUPLICATED = 'duplicated';

    protected $fillable = [
        'event_key', 'object', 'field', 'facebook_page_id',
        'status', 'summary', 'received_at',
    ];

    protected function casts(): array
    {
        return ['summary' => 'array', 'received_at' => 'datetime'];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class);
    }
}
