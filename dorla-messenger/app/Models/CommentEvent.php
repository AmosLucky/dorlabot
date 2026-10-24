<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommentEvent extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSED = 'processed';
    public const STATUS_SKIPPED = 'skipped';
    public const STATUS_FAILED = 'failed';
    public const STATUS_DUPLICATE = 'duplicate';

    protected $fillable = [
        'user_id', 'facebook_page_id', 'automation_rule_id', 'meta_comment_id',
        'meta_post_id', 'commenter_psid_like_id', 'commenter_name', 'message',
        'parent_id', 'status', 'skip_reason', 'private_replied_at',
        'private_reply_count', 'error_message', 'is_simulated',
    ];

    protected function casts(): array
    {
        return ['private_replied_at' => 'datetime', 'is_simulated' => 'boolean'];
    }

    public function page(): BelongsTo
    {
        return $this->belongsTo(FacebookPage::class, 'facebook_page_id');
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'automation_rule_id');
    }
}
