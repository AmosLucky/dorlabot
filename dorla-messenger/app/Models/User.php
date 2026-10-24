<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'business_name',
        'phone',
        'timezone',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'max_pages' => 'integer',
            'max_contacts' => 'integer',
            'max_broadcasts_per_month' => 'integer',
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Roles & authorization
    |--------------------------------------------------------------------------
    */

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function isSuperAdmin(): bool
    {
        return $this->roles()->where('name', 'super-admin')->exists();
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /*
    |--------------------------------------------------------------------------
    | Plan limits (nullable column => platform default from config)
    |--------------------------------------------------------------------------
    */

    public function maxPages(): int
    {
        return $this->max_pages ?? (int) config('dorla.limits.pages');
    }

    public function maxContacts(): int
    {
        return $this->max_contacts ?? (int) config('dorla.limits.contacts');
    }

    public function maxBroadcastsPerMonth(): int
    {
        return $this->max_broadcasts_per_month ?? (int) config('dorla.limits.broadcasts_per_month');
    }

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function facebookPages(): HasMany
    {
        return $this->hasMany(FacebookPage::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(MessengerContact::class);
    }

    public function automations(): HasMany
    {
        return $this->hasMany(AutomationRule::class);
    }

    public function broadcasts(): HasMany
    {
        return $this->hasMany(Broadcast::class);
    }

    public function accountSetting(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AccountSetting::class);
    }

    /*
    |--------------------------------------------------------------------------
    | Convenience
    |--------------------------------------------------------------------------
    */

    public function businessName(): string
    {
        return $this->accountSetting?->business_name
            ?: $this->business_name
            ?: $this->name;
    }
}
