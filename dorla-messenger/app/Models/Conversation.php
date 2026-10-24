<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'user_id', 'facebook_page_id', 'messenger_contact_id',
        'status', 'last_message_at', 'message_count',
    ];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(MessengerContact::class, 'messenger_contact_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(MessageEvent::class)->orderBy('occurred_at');
    }
}
