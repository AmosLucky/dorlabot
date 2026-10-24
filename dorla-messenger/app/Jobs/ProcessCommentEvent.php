<?php

namespace App\Jobs;

use App\Models\CommentEvent;
use App\Models\FacebookPage;
use App\Services\AutomationEngine;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Processes a feed (comment) webhook event: records it as a CommentEvent
 * and runs it through the comment-to-Messenger automation engine.
 *
 * Handles gracefully: deleted comments, unavailable posts, permission
 * failures, and duplicate deliveries.
 */
class ProcessCommentEvent implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [5, 30];

    public function __construct(
        public int $facebookPageId,
        public array $value,
    ) {}

    public function handle(AutomationEngine $engine): void
    {
        $page = FacebookPage::find($this->facebookPageId);

        if ($page === null || $page->status === FacebookPage::STATUS_DISABLED) {
            return;
        }

        $commentId = (string) ($this->value['comment_id'] ?? '');
        $postId = (string) ($this->value['post_id'] ?? '');

        if ($commentId === '') {
            return;
        }

        // Duplicate comment deliveries are collapsed by unique constraint.
        $exists = CommentEvent::where('meta_comment_id', $commentId)->exists();

        $commentEvent = CommentEvent::firstOrCreate(
            ['meta_comment_id' => $commentId],
            [
                'user_id' => $page->user_id,
                'facebook_page_id' => $page->id,
                'meta_post_id' => $postId ?: null,
                // Meta provides the commenter's app-scoped id ("from.id"),
                // used later as the recipient for the private reply thread.
                'commenter_psid_like_id' => (string) ($this->value['from']['id'] ?? ''),
                'commenter_name' => (string) ($this->value['from']['name'] ?? ''),
                'message' => (string) ($this->value['message'] ?? ''),
                'parent_id' => $this->value['parent_id'] ?? null,
                'status' => CommentEvent::STATUS_PENDING,
                'is_simulated' => isset($this->value['is_simulated']),
            ],
        );

        if ($exists) {
            $commentEvent->forceFill(['status' => CommentEvent::STATUS_DUPLICATE])->save();

            return;
        }

        // Only top-level comments trigger private replies (replies-to-replies
        // are recorded but skipped) — keeps behavior conservative.
        if (! empty($this->value['parent_id'])) {
            $commentEvent->forceFill([
                'status' => CommentEvent::STATUS_SKIPPED,
                'skip_reason' => 'Reply to another comment — only top-level comments are processed',
            ])->save();

            return;
        }

        try {
            $execution = $engine->handleComment($commentEvent, (bool) $commentEvent->is_simulated);

            if ($commentEvent->fresh()->status === CommentEvent::STATUS_PENDING) {
                $commentEvent->forceFill(['status' => CommentEvent::STATUS_PROCESSED])->save();
            }
        } catch (\Throwable $e) {
            $commentEvent->forceFill([
                'status' => CommentEvent::STATUS_FAILED,
                'error_message' => \Illuminate\Support\Str::limit($e->getMessage(), 240),
            ])->save();

            Log::error('Comment automation failed', [
                'comment_id' => $commentId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
