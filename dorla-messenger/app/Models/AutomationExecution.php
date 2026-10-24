<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationExecution extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_SENT = 'sent';
    public const STATUS_SKIPPED = 'skipped';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DUPLICATE = 'duplicate';

    protected $fillable = [
        'user_id', 'automation_rule_id', 'facebook_page_id', 'messenger_contact_id',
        'comment_event_id', 'trigger', 'matched_rule_detail', 'status', 'skip_reason',
        'rendered_message', 'meta_message_id', 'error_message', 'is_simulated',
    ];

    protected function casts(): array
    {
        return ['rendered_message' => 'array', 'is_simulated' => 'boolean'];
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'automation_rule_id');
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
