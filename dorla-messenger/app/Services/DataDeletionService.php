<?php

namespace App\Services;

use App\Models\AutomationRule;
use App\Models\AutomationExecution;
use App\Models\Broadcast;
use App\Models\DataDeletionRequest;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Processes approved data-deletion requests: removes or anonymizes all
 * personal data tied to the requesting account (GDPR/CCPA-style requests,
 * and Meta's data deletion callback requirements).
 */
class DataDeletionService
{
    public function __construct(
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Execute deletion for all approved requests (scheduler + admin action).
     */
    public static function processApprovedRequests(): int
    {
        $requests = DataDeletionRequest::whereIn('status', [DataDeletionRequest::STATUS_APPROVED, DataDeletionRequest::STATUS_PROCESSING])->get();
        $count = 0;

        foreach ($requests as $request) {
            try {
                app(self::class)->executeDeletion($request);
                $count++;
            } catch (\Throwable $e) {
                Log::error('Data deletion failed', ['request_id' => $request->id, 'error' => $e->getMessage()]);
            }
        }

        return $count;
    }

    /**
     * Delete all personal data belonging to the requesting user's account.
     * The user row itself is removed (login impossible afterwards).
     */
    public function executeDeletion(DataDeletionRequest $request): void
    {
        $request->forceFill(['status' => DataDeletionRequest::STATUS_PROCESSING])->save();

        $user = User::find($request->user_id);

        if ($user === null) {
            $request->forceFill([
                'status' => DataDeletionRequest::STATUS_COMPLETED,
                'processed_at' => now(),
            ])->save();

            return;
        }

        DB::transaction(function () use ($user, $request): void {
            // Anonymize audit trail entries that reference this user while
            // preserving platform audit history.
            \App\Models\AuditLog::where('actor_user_id', $user->id)->update(['changes' => null]);
            \App\Models\AuditLog::where('target_user_id', $user->id)->update(['changes' => null]);

            // Contacts and their personal data (cascades to tags, fields,
            // conversations, message events, opt-ins via FK constraints).
            MessengerContact::withTrashed()->where('user_id', $user->id)->forceDelete();

            // Disconnect pages and revoke stored tokens immediately.
            FacebookPage::where('user_id', $user->id)->update([
                'access_token_encrypted' => null,
                'status' => FacebookPage::STATUS_DISABLED,
                'status_message' => 'Disconnected by data deletion request',
            ]);

            // Anonymize message/broadcast history owned by the tenant.
            Broadcast::where('user_id', $user->id)->update(['message_text' => null]);
            AutomationRule::where('user_id', $user->id)->update([
                'message_text' => null,
                'fallback_text' => null,
                'follow_up_text' => null,
                'after_hours_text' => null,
            ]);

            // Remove the account entirely.
            $user->forceDelete();

            $request->forceFill([
                'status' => DataDeletionRequest::STATUS_COMPLETED,
                'processed_at' => now(),
            ])->save();

            $this->logger->info('data_deletion.completed', "Data deletion completed for request #{$request->id}");
        });
    }
}
