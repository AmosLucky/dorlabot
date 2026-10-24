<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageEvent extends Model
{
    public const DIRECTION_IN = 'inbound';
    public const DIRECTION_OUT = 'outbound';

    public const STATUS_SENT = 'sent';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_READ = 'read';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'user_id', 'facebook_page_id', 'messenger_contact_id', 'conversation_id',
        'broadcast_id', 'automation_execution_id', 'direction', 'meta_message_id',
        'recipient_psid', 'message_text', 'message_payload', 'message_type',
        'status', 'delivered_at', 'read_at', 'error_message', 'error_code',
        'is_simulated', 'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'message_payload' => 'array',
            'is_simulated' => 'boolean',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
            'occurred_at' => 'datetime',
        ];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(MessengerContact::class, 'messenger_contact_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(Broadcast::class);
    }
}
