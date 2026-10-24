# Meta App Review & Compliance Preparation

## 1. App configuration summary

| Item | Value |
|---|---|
| App type | Business |
| Products | Facebook Login for Business, Messenger, Webhooks |
| OAuth redirect URI | `https://dorlacode.com/api/facebook/callback` |
| Webhook callback URL | `https://dorlacode.com/api/webhooks/meta` |
| Webhook verify token | `META_WEBHOOK_VERIFY_TOKEN` env var |
| Webhook fields | `feed`, `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads` |

## 2. Permissions requested (only what is used)

| Permission | Why it is required |
|---|---|
| `pages_show_list` | List the Pages a customer manages so they can select one to connect |
| `pages_read_engagement` | Read Page posts for comment-automation post targeting; receive feed webhook events |
| `pages_manage_metadata` | Subscribe/unsubscribe the Page to the app's webhooks |
| `pages_messaging` | Send private replies to comments and Messenger messages on behalf of the Page |

No permission is requested for email addresses or other personal data beyond what Messenger
Platform provides (Page-scoped IDs and basic profile fields).

## 3. Reviewer instructions (paste into App Review)

DorlaCode helps businesses respond to people who interact with their Facebook Page.

1. **Connect a Page:** After signing up, click *Connect Facebook Page*, log in with the test
   Facebook account, and select the test Page you administer.
2. **Comment automation:** Create an automation (Comment Automations → New). Enable the trigger
   on any comment. Comment on a post on the test Page from a second test account. Within seconds
   the commenter receives a private reply in Messenger.
3. **Welcome message:** Message the test Page from the second test account; a personalized
   welcome is sent once.
4. **Default reply:** Message the Page with a configured keyword (e.g. “hours”); the keyword
   reply is sent. Send any other text; the fallback reply is sent.
5. **Campaign:** Open Contacts (the two test contacts exist), create a campaign with
   `{{first_name}}`, estimate the audience, launch. The message arrives in Messenger.
6. **Tracked link:** Click the link in the campaign message; the destination opens and the click
   appears in Analytics with unique-clicker deduplication.
7. **Analytics:** Opens Analytics to view sends, deliveries, reads, CTR with labeled denominators.

Reviewer test accounts: provide one Page-admin account and one commenter account, a seeded test
Page, and pre-configured automations (list credentials in the secure reviewer field).

## 4. Required public disclosures

- **Privacy Policy:** https://dorlacode.com/privacy (includes data deletion instructions)
- **Data deletion callback alternative:** in-app deletion (Settings → Security; account deletion
  removes all customer data) plus `support@dorlacode.com` requests
- **App icon, category, and business info** filled in App Dashboard → Settings → Basic

## 5. Platform policy rules encoded in the product

| Rule | Enforcement |
|---|---|
| One private reply per comment | `Message.commentId` unique constraint + eligibility check |
| Private reply window | Configurable `privateReplyWindowDays` (default 7); events outside → SKIPPED |
| Standard 24h messaging window | `Contact.messagingWindowUntil` opened only by inbound events; campaigns re-check per recipient |
| Opt-out / block respect | `OPTED_OUT`/`BLOCKED` states always excluded from sends |
| Comment ≠ marketing opt-in | Contacts from comments get `UNKNOWN` state, never campaign-eligible |
| No reply loops | Echoes and Page-originated events ignored; incoming `mid` dedupe |
| No bulk commenting / scraping | Not implemented by design; no feature exposes it |
| Messaging eligibility visibility | Every event shows processed / skipped / failed / policy-ineligible with reason |

## 6. Pre-launch validation checklist

- [ ] OAuth flow completes against the live domain (HTTPS, exact redirect URI match)
- [ ] Page connect → webhook subscription succeeds (`subscribed_apps` returns success)
- [ ] `GET /api/webhooks/meta` handshake returns `hub.challenge`
- [ ] Comment on test post → private reply delivered (within allowed permissions)
- [ ] Deliveries/read receipts update message statuses
- [ ] Campaign send respects closed windows and opt-outs
- [ ] Token expiry path: revoke app for test user → Page shows TOKEN_EXPIRED → reconnect works
- [ ] Business verification completed (required for `pages_messaging` at scale)
- [ ] Advanced Access granted for all four permissions

## 7. Keeping current

Meta changes messaging rules periodically. The eligibility windows are **platform settings**
(Admin → Platform Settings) so operators can adapt without redeploying. Sub-code handling for
common Graph errors (throttling 4/613/1200, token 190, permission 200/3/10) is centralized in
`src/lib/meta/client.ts` and `src/lib/eligibility.ts`.
