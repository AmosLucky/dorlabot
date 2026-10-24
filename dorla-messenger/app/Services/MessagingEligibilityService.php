<?php

namespace App\Services;

use App\Models\ContactCustomField;
use App\Models\FacebookPage;
use App\Models\MessengerContact;

/**
 * Centralizes Messenger messaging-policy checks (24-hour standard
 * messaging window, message tags, private replies, notification opt-ins).
 *
 * IMPORTANT: Meta policy and API behavior change over time. Values are
 * centralized in config/meta.php and this service so updates only require
 * configuration changes plus review of docs/PERMISSIONS.md.
 */
class MessagingEligibilityService
{
    /**
     * Can we send a standard (untagged) message to this contact right now?
     * Standard messaging requires the conversation to be within the
     * 24-hour standard messaging window opened by a user interaction.
     */
    public function withinStandardWindow(?MessengerContact $contact): bool
    {
        if ($contact === null) {
            return false;
        }

        $lastUserInteraction = $contact->last_user_message_at
            ?? $contact->last_interaction_at;

        if ($lastUserInteraction === null) {
            return false;
        }

        $windowHours = (int) config('meta.messaging.standard_window_hours', 24);

        return $lastUserInteraction->gt(now()->subHours($windowHours));
    }

    /**
     * Would a HUMAN_AGENT tagged message be permissible (7-day window,
     * human-agent-support use case only)?
     */
    public function humanAgentTagEligible(?MessengerContact $contact): bool
    {
        if ($contact === null) {
            return false;
        }

        $lastUserInteraction = $contact->last_user_message_at
            ?? $contact->last_interaction_at;

        if ($lastUserInteraction === null) {
            return false;
        }

        $windowHours = (int) config('meta.messaging.human_agent_tag_window_hours', 7);

        return $lastUserInteraction->gt(now()->subHours($windowHours));
    }

    /**
     * Decide whether an outbound message to a contact is allowed and, if so,
     * with which mechanism ('standard', 'tag:<TAG>', or not at all).
     *
     * @return array{allowed: bool, mechanism: ?string, reason: ?string}
     */
    public function evaluate(
        ?MessengerContact $contact,
        ?string $requestedTag = null,
        bool $isAutomatedReplyToUserAction = false,
    ): array {
        if ($contact === null) {
            return ['allowed' => false, 'mechanism' => null, 'reason' => 'Unknown recipient'];
        }

        // Automated replies to a user's own message/postback are allowed
        // within the standard window regardless of promotional intent.
        if ($isAutomatedReplyToUserAction && $this->withinStandardWindow($contact)) {
            return ['allowed' => true, 'mechanism' => 'standard', 'reason' => null];
        }

        if ($this->withinStandardWindow($contact)) {
            return ['allowed' => true, 'mechanism' => 'standard', 'reason' => null];
        }

        // Outside the 24h window: only specific, permitted message tags apply.
        $allowedTags = config('meta.messaging.allowed_message_tags', []);

        if ($requestedTag !== null && in_array($requestedTag, $allowedTags, true)) {
            if ($requestedTag === 'HUMAN_AGENT') {
                if ($this->humanAgentTagEligible($contact)) {
                    return ['allowed' => true, 'mechanism' => 'tag:HUMAN_AGENT', 'reason' => null];
                }

                return ['allowed' => false, 'mechanism' => null, 'reason' => 'Outside the 7-day HUMAN_AGENT window'];
            }

            // Structured tags are only usable when the contact opted in to
            // notifications for this flow (recorded opt-in is required).
            if ($contact->opted_in_notifications) {
                return ['allowed' => true, 'mechanism' => 'tag:'.$requestedTag, 'reason' => null];
            }

            return ['allowed' => false, 'mechanism' => null, 'reason' => 'Message tag requested but no recorded opt-in'];
        }

        return [
            'allowed' => false,
            'mechanism' => null,
            'reason' => 'Outside the 24-hour messaging window and no eligible message tag/opt-in. Ask the contact to message you again.',
        ];
    }

    /**
     * Private replies to comments: only ONE private reply per comment,
     * within the configured window (7 days), and only when the event has
     * not already been answered. Enforces Meta private-reply constraints.
     */
    public function privateReplyEligible(\App\Models\CommentEvent $event): array
    {
        $windowHours = (int) config('meta.messaging.private_reply_window_hours', 7);
        $maxReplies = (int) config('meta.messaging.private_reply_per_comment', 1);

        if ($event->private_reply_count >= $maxReplies) {
            return ['allowed' => false, 'reason' => 'Private reply already sent for this comment (one-reply limit)'];
        }

        $createdAt = $event->created_at ?? now();
        if ($createdAt->lt(now()->subHours($windowHours))) {
            return ['allowed' => false, 'reason' => "Older than the {$windowHours}-hour private-reply window"];
        }

        if (empty($event->commenter_psid_like_id)) {
            return ['allowed' => false, 'reason' => 'Commenter id unavailable for private reply'];
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Evaluate a whole audience segment for a broadcast. Returns only the
     * eligible contacts; ineligible ones are reported with reasons.
     *
     * @return array{eligible: \Illuminate\Support\Collection, skipped: \Illuminate\Support\Collection}
     */
    public function filterBroadcastAudience(
        \Illuminate\Support\Collection $contacts,
        ?string $messageTag = null,
    ): array {
        $eligible = collect();
        $skipped = collect();

        foreach ($contacts as $contact) {
            $result = $this->evaluate($contact, $messageTag);

            if ($result['allowed']) {
                $eligible->push($contact);
            } else {
                $skipped->push([
                    'contact' => $contact,
                    'reason' => $result['reason'],
                ]);
            }
        }

        return ['eligible' => $eligible, 'skipped' => $skipped];
    }

    /**
     * Record an opt-in when a user takes an explicit opt-in action
     * (e.g. taps an opt-in postback button).
     */
    public function recordOptIn(MessengerContact $contact, string $topic = 'general', string $source = 'postback'): void
    {
        $contact->forceFill([
            'opted_in_notifications' => true,
            'opted_in_at' => now(),
        ])->save();

        \App\Models\NotificationOptIn::create([
            'user_id' => $contact->user_id,
            'facebook_page_id' => $contact->facebook_page_id,
            'messenger_contact_id' => $contact->id,
            'topic' => $topic,
            'source' => $source,
            'opted_in_at' => now(),
        ]);
    }
}
