<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AutomationRule extends Model
{
    public const TYPE_WELCOME = 'welcome';
    public const TYPE_DEFAULT_REPLY = 'default_reply';
    public const TYPE_KEYWORD = 'keyword';
    public const TYPE_COMMENT_REPLY = 'comment_reply';

    public const MATCH_CONTAINS = 'contains';
    public const MATCH_EXACT = 'exact';
    public const MATCH_STARTS_WITH = 'starts_with';
    public const MATCH_ANY = 'any';

    protected $fillable = [
        'user_id', 'facebook_page_id', 'type', 'name', 'is_enabled',
        'match_type', 'keywords', 'meta_post_id', 'post_url',
        'message_text', 'buttons', 'quick_replies', 'fallback_text', 'follow_up_text',
        'business_hours_enabled', 'business_hours_start', 'business_hours_end',
        'business_hours_timezone', 'after_hours_text',
        'handoff_enabled', 'handoff_text', 'priority', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'buttons' => 'array',
            'quick_replies' => 'array',
            'is_enabled' => 'boolean',
            'business_hours_enabled' => 'boolean',
            'business_hours_start' => 'datetime:H:i',
            'business_hours_end' => 'datetime:H:i',
            'handoff_enabled' => 'boolean',
            'published_at' => 'datetime',
            'priority' => 'integer',
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

    public function steps(): HasMany
    {
        return $this->hasMany(AutomationStep::class)->orderBy('sequence');
    }

    public function executions(): HasMany
    {
        return $this->hasMany(AutomationExecution::class);
    }

    public function commentEvents(): HasMany
    {
        return $this->hasMany(CommentEvent::class);
    }

    public function trackedLinks(): HasMany
    {
        return $this->hasMany(TrackedLink::class);
    }

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('automation_rules.user_id', $userId);
    }

    public function scopeType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }

    public function typeLabel(): string
    {
        return match ($this->type) {
            self::TYPE_WELCOME => 'Welcome message',
            self::TYPE_DEFAULT_REPLY => 'Default auto reply',
            self::TYPE_KEYWORD => 'Keyword rule',
            self::TYPE_COMMENT_REPLY => 'Comment automation',
            default => ucfirst(str_replace('_', ' ', $this->type)),
        };
    }

    /**
     * Message payload for the Messenger Send API built from this rule.
     */
    public function sendPayload(string $renderedText): array
    {
        $payload = ['text' => $renderedText];

        if (! empty($this->quick_replies)) {
            $payload['quick_replies'] = collect($this->quick_replies)
                ->take(11)
                ->map(fn ($qr) => [
                    'content_type' => 'text',
                    'title' => mb_substr((string) ($qr['title'] ?? ''), 0, 20),
                    'payload' => (string) ($qr['payload'] ?? mb_substr((string) ($qr['title'] ?? ''), 0, 20)),
                ])->values()->all();
        } elseif (! empty($this->buttons)) {
            $payload['buttons'] = collect($this->buttons)
                ->take(3)
                ->map(function ($btn): ?array {
                    $type = $btn['type'] ?? 'web_url';
                    if ($type === 'web_url') {
                        $url = (string) ($btn['url'] ?? '');
                        if ($url === '') {
                            return null;
                        }

                        return [
                            'type' => 'web_url',
                            'url' => $url,
                            'title' => mb_substr((string) ($btn['title'] ?? 'Open'), 0, 20),
                        ];
                    }

                    return [
                        'type' => 'postback',
                        'title' => mb_substr((string) ($btn['title'] ?? ''), 0, 20),
                        'payload' => (string) ($btn['payload'] ?? mb_substr((string) ($btn['title'] ?? ''), 0, 20)),
                    ];
                })->filter()->values()->all();
        }

        return $payload;
    }
}
