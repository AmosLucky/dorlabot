<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MessengerContact extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id', 'facebook_page_id', 'psid', 'first_name', 'last_name',
        'locale', 'timezone_offset', 'source', 'meta_profile',
        'first_interaction_at', 'last_interaction_at', 'last_messaged_at',
        'last_user_message_at', 'opted_in_notifications', 'opted_in_at',
    ];

    protected function casts(): array
    {
        return [
            'meta_profile' => 'array',
            'first_interaction_at' => 'datetime',
            'last_interaction_at' => 'datetime',
            'last_messaged_at' => 'datetime',
            'last_user_message_at' => 'datetime',
            'opted_in_notifications' => 'boolean',
            'opted_in_at' => 'datetime',
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

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ContactTag::class, 'contact_tag_assignments');
    }

    public function customFields(): HasMany
    {
        return $this->hasMany(ContactCustomField::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function messageEvents(): HasMany
    {
        return $this->hasMany(MessageEvent::class);
    }

    public function executions(): HasMany
    {
        return $this->hasMany(AutomationExecution::class);
    }

    public function optIns(): HasMany
    {
        return $this->hasMany(NotificationOptIn::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Scopes (tenant safety helpers)
    |--------------------------------------------------------------------------
    */

    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('messenger_contacts.user_id', $userId);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (! $term) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($term): void {
            $q->where('first_name', 'like', "%{$term}%")
                ->orWhere('last_name', 'like', "%{$term}%")
                ->orWhere('psid', 'like', "%{$term}%");
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    public function fullName(): string
    {
        $name = trim(($this->first_name ?? '').' '.($this->last_name ?? ''));

        return $name !== '' ? $name : 'Subscriber #'.$this->id;
    }

    public function firstName(): string
    {
        return $this->first_name ?: ($this->user?->accountSetting?->default_fallback_first_name ?? 'there');
    }

    public function customFieldValue(string $key): ?string
    {
        return $this->customFields->firstWhere('field_key', $key)?->field_value;
    }
}
