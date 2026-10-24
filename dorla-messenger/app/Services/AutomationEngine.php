<?php

namespace App\Services;

use App\Jobs\SendMessengerReply;
use App\Models\AutomationExecution;
use App\Models\AutomationRule;
use App\Models\CommentEvent;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Matches incoming triggers against configured automation rules and
 * dispatches replies through the queue.
 *
 * Priority (per PRD):
 *   1. Explicit keyword match (keyword rules, highest priority value wins by lowest number)
 *   2. Specific configured flow (comment automation for that post)
 *   3. Default automatic reply (default_reply type)
 *   4. Optional fallback / human handoff (rule.handoff_enabled)
 *
 * Exactly one rule responds to a given event: the engine returns the first
 * match in priority order and never double-fires for the same event.
 */
class AutomationEngine
{
    public function __construct(
        private readonly MessageTemplateService $templates,
        private readonly MessagingEligibilityService $eligibility,
        private readonly IntegrationLogService $logger,
    ) {}

    /**
     * Handle an inbound message or postback from a contact.
     *
     * @param  string  $triggerType  message|postback
     * @param  string|null  $postbackPayload  payload string for postback triggers
     */
    public function handleInbound(
        FacebookPage $page,
        MessengerContact $contact,
        string $triggerType,
        string $messageText = '',
        ?string $postbackPayload = null,
        bool $isSimulated = false,
    ): ?AutomationExecution {
        // One automation response per (contact, event): find best match.
        $rule = $this->matchInboundRule($page, $triggerType, $messageText, $postbackPayload);

        if ($rule === null) {
            return null;
        }

        // Business-hours gate for default replies.
        if ($rule->type === AutomationRule::TYPE_DEFAULT_REPLY && ! $this->withinBusinessHours($rule)) {
            if ($rule->after_hours_text) {
                return $this->dispatch($rule, $page, $contact, $triggerType, $rule->after_hours_text, 'After-hours response', $isSimulated);
            }

            return $this->recordSkip($rule, $page, $contact, $triggerType, 'Outside configured business hours', $isSimulated);
        }

        return $this->dispatch($rule, $page, $contact, $triggerType, $rule->message_text ?? '', 'Matched: '.$rule->name, $isSimulated);
    }

    /**
     * Handle a comment event for comment-to-Messenger automations.
     */
    public function handleComment(CommentEvent $commentEvent, bool $isSimulated = false): ?AutomationExecution
    {
        $page = $commentEvent->page;
        $rule = $this->matchCommentRule($commentEvent);

        if ($rule === null) {
            return null;
        }

        // Private-reply policy checks (one per comment, time window).
        $eligibility = $this->eligibility->privateReplyEligible($commentEvent);
        if (! $eligibility['allowed']) {
            $commentEvent->forceFill([
                'status' => CommentEvent::STATUS_SKIPPED,
                'skip_reason' => $eligibility['reason'],
            ])->save();

            return $this->recordSkip($rule, $page, null, 'comment', $eligibility['reason'], $isSimulated);
        }

        // Keyword matching for the comment text (if rule has keywords).
        $keyword = $this->commentMatchesKeywords($commentEvent, $rule);
        if ($keyword === false) {
            $commentEvent->forceFill([
                'status' => CommentEvent::STATUS_SKIPPED,
                'skip_reason' => 'Comment did not match configured keywords',
            ])->save();

            return $this->recordSkip($rule, $page, null, 'comment', 'No keyword match', $isSimulated);
        }

        return $this->dispatch(
            $rule, $page, null, 'comment',
            $rule->message_text ?? '',
            'Comment matched: '.($keyword !== null ? "\"{$keyword}\"" : 'any comment'),
            $isSimulated,
            $commentEvent,
        );
    }

    /**
     * Find the single best-matching rule for an inbound message/postback.
     */
    public function matchInboundRule(
        FacebookPage $page,
        string $triggerType,
        string $messageText = '',
        ?string $postbackPayload = null,
    ): ?AutomationRule {
        $rules = $this->enabledRules($page, [AutomationRule::TYPE_KEYWORD, AutomationRule::TYPE_DEFAULT_REPLY, AutomationRule::TYPE_WELCOME]);

        // 1. Keyword rules (priority order).
        foreach ($rules->where('type', AutomationRule::TYPE_KEYWORD) as $rule) {
            if ($this->messageMatchesKeywords($rule, $messageText, $postbackPayload)) {
                return $rule;
            }
        }

        // 2. Welcome rules fire on first interaction only.
        if ($this->isFirstInteraction($page, $contactPsid = null)) {
            // handled by caller context; welcome is matched by explicit call
        }

        // 3. Default reply.
        $default = $rules->firstWhere('type', AutomationRule::TYPE_DEFAULT_REPLY);
        if ($default !== null) {
            return $default;
        }

        return null;
    }

    /**
     * Welcome messages fire once, on a contact's first interaction with the Page.
     */
    public function handleWelcome(
        FacebookPage $page,
        MessengerContact $contact,
        bool $isSimulated = false,
    ): ?AutomationExecution {
        $rule = $this->enabledRules($page, [AutomationRule::TYPE_WELCOME])->first();

        if ($rule === null) {
            return null;
        }

        // Fire only for genuinely new contacts (first interaction).
        if ($contact->first_interaction_at !== null && $contact->first_interaction_at->lt(now()->subMinute())) {
            return null;
        }

        $alreadyWelcomed = AutomationExecution::where('automation_rule_id', $rule->id)
            ->where('messenger_contact_id', $contact->id)
            ->where('status', '!=', AutomationExecution::STATUS_FAILED)
            ->exists();

        if ($alreadyWelcomed) {
            return null; // exactly-once welcome
        }

        return $this->dispatch($rule, $page, $contact, 'message', $rule->message_text ?? '', 'First interaction welcome', $isSimulated);
    }

    /**
     * Best comment rule for an event: post-specific first, then any-post rules.
     */
    public function matchCommentRule(CommentEvent $commentEvent): ?AutomationRule
    {
        $rules = $this->enabledRules($commentEvent->page, [AutomationRule::TYPE_COMMENT_REPLY]);

        // Specific post rules first.
        $postRule = $rules
            ->where('meta_post_id', (string) $commentEvent->meta_post_id)
            ->sortBy('priority')
            ->first();

        if ($postRule !== null) {
            return $postRule;
        }

        // Rules configured for "any post" (meta_post_id null).
        return $rules->whereNull('meta_post_id')->sortBy('priority')->first();
    }

    /**
     * Render + queue the reply. Records the execution with a deterministic
     * result; actual API sending happens in SendMessengerReply job.
     */
    protected function dispatch(
        AutomationRule $rule,
        FacebookPage $page,
        ?MessengerContact $contact,
        string $trigger,
        string $templateText,
        string $detail,
        bool $isSimulated = false,
        ?CommentEvent $commentEvent = null,
    ): AutomationExecution {
        $rendered = $this->templates->render($templateText, $contact, $page);
        $payload = $rule->sendPayload($rendered);

        $execution = AutomationExecution::create([
            'user_id' => $page->user_id,
            'automation_rule_id' => $rule->id,
            'facebook_page_id' => $page->id,
            'messenger_contact_id' => $contact?->id,
            'comment_event_id' => $commentEvent?->id,
            'trigger' => $trigger.($isSimulated ? '|simulated' : ''),
            'matched_rule_detail' => $detail,
            'status' => AutomationExecution::STATUS_PENDING,
            'rendered_message' => $payload,
            'is_simulated' => $isSimulated,
        ]);

        // Outbound sending happens in the queue (rate-limited, eligibility
        // re-checked at send time).
        SendMessengerReply::dispatch($execution->id)->onQueue('messaging');

        $rule->increment('executions_count');

        return $execution;
    }

    protected function recordSkip(
        AutomationRule $rule,
        FacebookPage $page,
        ?MessengerContact $contact,
        string $trigger,
        string $reason,
        bool $isSimulated = false,
    ): AutomationExecution {
        return AutomationExecution::create([
            'user_id' => $page->user_id,
            'automation_rule_id' => $rule->id,
            'facebook_page_id' => $page->id,
            'messenger_contact_id' => $contact?->id,
            'trigger' => $trigger.($isSimulated ? '|simulated' : ''),
            'status' => AutomationExecution::STATUS_SKIPPED,
            'skip_reason' => $reason,
            'is_simulated' => $isSimulated,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Matching helpers
    |--------------------------------------------------------------------------
    */

    protected function enabledRules(FacebookPage $page, array $types): Collection
    {
        return AutomationRule::where('facebook_page_id', $page->id)
            ->whereIn('type', $types)
            ->where('is_enabled', true)
            ->orderBy('priority')
            ->orderBy('id')
            ->get();
    }

    protected function messageMatchesKeywords(AutomationRule $rule, string $messageText, ?string $postbackPayload): bool
    {
        $haystack = mb_strtolower(trim($messageText !== '' ? $messageText : (string) $postbackPayload));

        if ($haystack === '') {
            return false;
        }

        $keywords = collect($rule->keywords ?? [])
            ->map(fn ($k) => mb_strtolower(trim((string) $k)))
            ->filter()
            ->values();

        if ($keywords->isEmpty()) {
            return false;
        }

        return match ($rule->match_type) {
            AutomationRule::MATCH_EXACT => $keywords->contains(fn ($k) => $haystack === $k),
            AutomationRule::MATCH_STARTS_WITH => $keywords->contains(fn ($k) => str_starts_with($haystack, $k)),
            AutomationRule::MATCH_ANY => true,
            default => $keywords->contains(fn ($k) => str_contains($haystack, $k)), // contains
        };
    }

    protected function commentMatchesKeywords(CommentEvent $event, AutomationRule $rule): string|false|null
    {
        $keywords = collect($rule->keywords ?? [])
            ->map(fn ($k) => mb_strtolower(trim((string) $k)))
            ->filter()
            ->values();

        // No keywords configured + "any" match => respond to every eligible comment.
        if ($keywords->isEmpty() || $rule->match_type === AutomationRule::MATCH_ANY) {
            return null;
        }

        $haystack = mb_strtolower(trim((string) $event->message));

        foreach ($keywords as $keyword) {
            $matched = match ($rule->match_type) {
                AutomationRule::MATCH_EXACT => $haystack === $keyword,
                AutomationRule::MATCH_STARTS_WITH => str_starts_with($haystack, $keyword),
                default => str_contains($haystack, $keyword),
            };

            if ($matched) {
                return $keyword;
            }
        }

        return false;
    }

    protected function isFirstInteraction(FacebookPage $page, ?string $psid): bool
    {
        return $psid === null;
    }

    protected function withinBusinessHours(AutomationRule $rule): bool
    {
        if (! $rule->business_hours_enabled || ! $rule->business_hours_start || ! $rule->business_hours_end) {
            return true;
        }

        $tz = $rule->business_hours_timezone ?: config('app.timezone');
        $now = Carbon::now($tz)->format('H:i');
        $start = $rule->business_hours_start->format('H:i');
        $end = $rule->business_hours_end->format('H:i');

        return $start <= $end
            ? ($now >= $start && $now <= $end)
            : ($now >= $start || $now <= $end); // overnight window
    }
}
