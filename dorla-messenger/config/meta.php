<?php

/**
 * Meta (Facebook) Graph API & Messenger Platform configuration.
 *
 * All values come from the environment. Never hardcode secrets here.
 * The application stays fully bootable with placeholder values; live
 * Graph API operations are gated behind MetaCredentialGuard checks.
 */

return [

    'app_id' => env('META_APP_ID'),
    'app_secret' => env('META_APP_SECRET'),

    // Facebook Login for Business configuration id (optional, only needed
    // when you create a Login Config in the Meta app dashboard).
    'login_config_id' => env('META_LOGIN_CONFIG_ID'),

    // Random string used for the GET /webhooks/meta/messenger handshake.
    'webhook_verify_token' => env('META_WEBHOOK_VERIFY_TOKEN'),

    // Keep configurable; update to the newest supported version when Meta
    // announces deprecations (https://developers.facebook.com/docs/graph-api/changelog).
    'graph_api_version' => env('META_GRAPH_API_VERSION', 'v23.0'),

    // Must match the "Valid OAuth Redirect URIs" registered on the Meta app.
    'redirect_uri' => env('META_REDIRECT_URI', 'https://dorlacode.com/auth/meta/callback'),

    // Canonical public URL of this platform.
    'app_url' => env('META_APP_URL', env('APP_URL', 'https://dorlacode.com')),

    // Permissions requested during OAuth. Keep to the minimum required by
    // implemented features (see docs/PERMISSIONS.md).
    'permissions' => array_values(array_filter(explode(',', (string) env(
        'META_PERMISSIONS',
        'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_read_user_content,business_management'
    )))),

    // Webhook fields we ask Meta to subscribe to for each Page.
    'page_webhook_fields' => ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads', 'feed'],

    'oauth' => [
        'dialog_url' => 'https://www.facebook.com/%s/dialog/oauth',
        'token_url' => 'https://graph.facebook.com/oauth/access_token',
    ],

    'graph_base_url' => 'https://graph.facebook.com',

    /**
     * Standard Messenger messaging window (user-initiated, hours).
     * Meta policy values are centralised here so policy updates only
     * require changing configuration, not scattering literals.
     */
    'messaging' => [
        'standard_window_hours' => 24,
        'human_agent_tag_window_hours' => 7,
        'private_reply_window_hours' => 7,
        'private_reply_per_comment' => 1,

        // Message tags allowed for out-of-window sends (eligible use cases only).
        'allowed_message_tags' => [
            'ACCOUNT_UPDATE',
            'RESERVATION_UPDATE',
            'POST_PURCHASE_UPDATE',
            'HUMAN_AGENT',
        ],
    ],

    /**
     * Broadcast rate limiting for the Send API (messages per second per Page
     * is enforced by the queue worker; Meta documents 250 calls/second app-level).
     */
    'send_rate_limit_per_second' => 20,
];
