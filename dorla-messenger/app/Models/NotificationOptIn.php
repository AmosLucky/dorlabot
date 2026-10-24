<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationOptIn extends Model
{
    protected $fillable = [
        'user_id', 'facebook_page_id', 'messenger_contact_id',
        'topic', 'source', 'opted_in_at', 'opted_out_at',
    ];

    protected function casts(): array
    {
        return ['opted_in_at' => 'datetime', 'opted_out_at' => 'datetime'];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(MessengerContact::class, 'messenger_contact_id');
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }
}
