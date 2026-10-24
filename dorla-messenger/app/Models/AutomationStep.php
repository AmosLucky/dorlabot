<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationStep extends Model
{
    protected $fillable = [
        'automation_rule_id', 'sequence', 'step_type',
        'message_text', 'payload', 'delay_seconds',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array', 'delay_seconds' => 'integer'];
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AutomationRule::class, 'automation_rule_id');
    }
}
