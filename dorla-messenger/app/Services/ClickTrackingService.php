<?php

namespace App\Services;

use App\Models\Broadcast;
use App\Models\BroadcastRecipient;
use App\Models\FacebookPage;
use App\Models\LinkClickEvent;
use App\Models\MessengerContact;
use App\Models\TrackedLink;
use Illuminate\Support\Str;

/**
 * First-party click tracking: unique tracking URLs per outbound message
 * and campaign, click recording, and validated redirects (no open-redirect
 * vulnerabilities — only stored destinations are ever redirected to).
 */
class ClickTrackingService
{
    /**
     * Create (or reuse) a tracked link for a destination in a context.
     */
    public function createLink(
        int $userId,
        string $destinationUrl,
        ?FacebookPage $page = null,
        ?Broadcast $broadcast = null,
        ?AutomationRule $rule = null,
        ?string $label = null,
    ): TrackedLink {
        $this->assertSafeDestination($destinationUrl);

        return TrackedLink::create([
            'user_id' => $userId,
            'facebook_page_id' => $page?->id,
            'broadcast_id' => $broadcast?->id,
            'automation_rule_id' => $rule?->id,
            'tracking_code' => Str::random(12),
            'destination_url' => $destinationUrl,
            'label' => $label,
        ]);
    }

    /**
     * Record a click for a tracking code and return the destination,
     * or null when the code is invalid.
     *
     * @return array{destination: ?string, link: ?TrackedLink}
     */
    public function recordClick(
        string $trackingCode,
        ?string $ip = null,
        ?string $userAgent = null,
        ?string $recipientPsid = null,
    ): array {
        $link = TrackedLink::where('tracking_code', $trackingCode)->first();

        if ($link === null) {
            return ['destination' => null, 'link' => null];
        }

        $contact = $recipientPsid !== null
            ? MessengerContact::where('psid', $recipientPsid)
                ->where('user_id', $link->user_id)->first()
            : null;

        $ipHash = $ip !== null ? hash('sha256', $ip.'|'.$link->id.'|'.config('app.key')) : null;

        // Dedup: same link + same contact (or same ip hash) within 10 min counts once.
        $recentDuplicate = LinkClickEvent::where('tracked_link_id', $link->id)
            ->where('clicked_at', '>=', now()->subMinutes(10))
            ->when($contact !== null,
                fn ($q) => $q->where('messenger_contact_id', $contact->id),
                fn ($q) => $ipHash !== null ? $q->where('ip_hash', $ipHash) : $q->whereRaw('0 = 1'))
            ->exists();

        if (! $recentDuplicate) {
            LinkClickEvent::create([
                'tracked_link_id' => $link->id,
                'user_id' => $link->user_id,
                'messenger_contact_id' => $contact?->id,
                'recipient_psid' => $recipientPsid,
                'ip_hash' => $ipHash,
                'user_agent' => Str::limit((string) $userAgent, 250) ?: null,
                'clicked_at' => now(),
            ]);

            $link->increment('clicks_count');
        }

        $uniqueCount = LinkClickEvent::where('tracked_link_id', $link->id)
            ->distinct('recipient_psid')->count('recipient_psid');
        $link->forceFill(['unique_clicks_count' => $uniqueCount])->save();

        // Mark the broadcast recipient as clicked when applicable.
        if ($link->broadcast_id !== null && $contact !== null) {
            BroadcastRecipient::where('broadcast_id', $link->broadcast_id)
                ->where('messenger_contact_id', $contact->id)
                ->whereNotIn('status', ['clicked'])
                ->whereNotNull('sent_at')
                ->update(['status' => 'clicked', 'clicked_at' => now()]);
        }

        return ['destination' => $link->destination_url, 'link' => $link];
    }

    /**
     * Validate a destination URL before storing (blocks open redirects and
     * dangerous schemes).
     */
    public function assertSafeDestination(string $url): void
    {
        $parts = parse_url($url);

        if ($parts === false || ! isset($parts['scheme'], $parts['host'])) {
            throw new \InvalidArgumentException('Destination must be an absolute http(s) URL');
        }

        if (! in_array(strtolower((string) $parts['scheme']), ['http', 'https'], true)) {
            throw new \InvalidArgumentException('Only http/https destinations are allowed');
        }

        if (in_array(strtolower((string) $parts['host']), ['localhost', '127.0.0.1', '0.0.0.0', '::1'], true)) {
            throw new \InvalidArgumentException('Loopback destinations are not allowed');
        }

        // Public tracking URLs must point at a real site, not our own
        // redirect endpoints (prevents redirect loops).
        $self = parse_url((string) config('meta.app_url'), PHP_URL_HOST);
        if ($self !== null && strtolower((string) $parts['host']) === strtolower((string) $self) && str_starts_with((string) ($parts['path'] ?? ''), '/c/')) {
            throw new \InvalidArgumentException('Tracked links cannot point to other tracked links');
        }
    }
}
