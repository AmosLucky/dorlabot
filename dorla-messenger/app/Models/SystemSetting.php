<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    protected $fillable = ['key', 'value', 'group', 'description'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    /**
     * Read a setting with a default fallback (cached).
     */
    public static function value(string $key, mixed $default = null): mixed
    {
        return Cache::remember('system_setting.'.$key, 300, function () use ($key, $default) {
            $row = static::query()->where('key', $key)->first();

            return $row?->value ?? $default;
        });
    }

    /**
     * Create or update a setting and flush its cache.
     */
    public static function put(string $key, mixed $value, string $group = 'general', ?string $description = null): self
    {
        $setting = static::updateOrCreate(['key' => $key], [
            'value' => $value,
            'group' => $group,
            'description' => $description,
        ]);

        Cache::forget('system_setting.'.$key);

        return $setting;
    }
}
