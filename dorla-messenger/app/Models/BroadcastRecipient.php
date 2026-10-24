<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BroadcastRecipient extends Model
{
    protected $fillable = [
        'broadcast_id', 'messenger_contact_id', 'recipient_psid', 'status',
        'skip_reason', 'meta_message_id', 'error_message',
        'sent_at', 'delivered_at', 'read_at', 'clicked_at', 'is_simulated',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
            'clicked_at' => 'datetime',
            'is_simulated' => 'boolean',
        ];
    }

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(Broadcast::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(MessengerContact::class, 'messenger_contact_id');
    }
}
