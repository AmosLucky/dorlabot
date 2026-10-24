<?php

namespace App\Jobs;

use App\Models\AutomationExecution;
use App\Models\AutomationRule;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use App\Services\MessagingEligibilityService;
use App\Services\MessengerSendService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * Sends an automation reply produced by the AutomationEngine.
 * Re-checks messaging eligibility immediately before sending.
 */
class SendMessengerReply implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [10, 60];

    public function __construct(
        public int $executionId,
    ) {}

    public function handle(
        MessengerSendService $sender,
        MessagingEligibilityService $eligibility,
    ): void {
        $execution = AutomationExecution::with(['page', 'contact', 'rule'])->find($this->executionId);

        if ($execution === null) {
            return;
        }

        $page = $execution->page;
        $rule = $execution->rule;

        if ($page === null || $rule === null || $page->status === FacebookPage::STATUS_DISABLED) {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SKIPPED,
                'skip_reason' => 'Page unavailable or disabled',
            ])->save();

            return;
        }

        /** @var array{text?: string, buttons?: array, quick_replies?: array} $payload */
        $payload = $execution->rendered_message ?? ['text' => ''];

        // Comment private replies follow a separate code path.
        if ($execution->comment_event_id !== null) {
            $this->sendPrivateReply($execution, $sender, $eligibility, $payload);

            return;
        }

        $contact = $execution->contact;

        // Eligibility check for DM replies: these are automated responses to
        // a user action (message/postback) — allowed within the standard window.
        $evaluation = $eligibility->evaluate($contact, null, isAutomatedReplyToUserAction: true);

        if (! $evaluation['allowed']) {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SKIPPED,
                'skip_reason' => Str::limit((string) $evaluation['reason'], 240),
            ])->save();

            return;
        }

        $psid = $contact?->psid;

        if ($psid === null) {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SKIPPED,
                'skip_reason' => 'Recipient PSID unavailable',
            ])->save();

            return;
        }

        $result = $sender->send(
            $page,
            $psid,
            $payload,
            $contact,
            null,
            null,
            $execution,
        );

        if ($result['ok']) {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SENT,
                'meta_message_id' => $result['message_event']->meta_message_id,
            ])->save();

            $rule->increment('replies_sent_count');
        } else {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_FAILED,
                'error_message' => Str::limit((string) $result['error'], 240),
            ])->save();
        }
    }

    /**
     * Private reply flow: creates/updates the comment's Messenger contact
     * (only after Meta confirms the private reply thread is open).
     */
    protected function sendPrivateReply(
        AutomationExecution $execution,
        MessengerSendService $sender,
        MessagingEligibilityService $eligibility,
        array $payload,
    ): void {
        $commentEvent = $execution->commentEvent()->first();

        if ($commentEvent === null || $commentEvent->private_reply_count >= 1) {
            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SKIPPED,
                'skip_reason' => 'Private reply already sent for this comment',
            ])->save();

            return;
        }

        $page = $execution->page;

        $result = $sender->sendPrivateReply(
            $page,
            (string) $commentEvent->meta_comment_id,
            (string) ($payload['text'] ?? ''),
            $execution,
        );

        if ($result['ok']) {
            // After a successful private reply Meta returns a recipient id;
            // in live mode we use it to track the new contact conservatively.
            $commentEvent->forceFill([
                'private_replied_at' => now(),
                'private_reply_count' => $commentEvent->private_reply_count + 1,
                'status' => \App\Models\CommentEvent::STATUS_PROCESSED,
            ])->save();

            $execution->forceFill([
                'status' => AutomationExecution::STATUS_SENT,
                'meta_message_id' => $result['message_event']->meta_message_id,
            ])->save();

            $execution->rule->increment('replies_sent_count');

            // Optional follow-up conversation is only sent when the recipient
            // replies (24h window opens) — never assumed here.
        } else {
            $commentEvent->forceFill([
                'status' => \App\Models\CommentEvent::STATUS_FAILED,
                'error_message' => Str::limit((string) $result['error'], 240),
            ])->save();

            $execution->forceFill([
                'status' => AutomationExecution::STATUS_FAILED,
                'error_message' => Str::limit((string) $result['error'], 240),
            ])->save();
        }
    }
}
