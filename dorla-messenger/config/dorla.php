<?php

/**
 * Dorla platform configuration: subscription readiness, limits,
 * simulation mode and feature flags.
 */

return [

    /**
     * Development simulation mode. When enabled (local environments only),
     * automation/webhook flows can be exercised with clearly labeled
     * SIMULATED Meta events. Live delivery is never simulated silently:
     * every simulated send is persisted with is_simulated=true and rendered
     * with a visible badge across the UI.
     */
    'simulation' => (bool) env('DORLA_SIMULATION', false),

    /**
     * Subscription/plan readiness. Billing is intentionally NOT built-in.
     * Plan definitions are stored in system_settings (key: plans) and
     * editable from the super-admin dashboard; limits are enforced per
     * account once subscriptions are switched on.
     */
    'billing_enabled' => (bool) env('DORLA_BILLING_ENABLED', false),

    'plans' => [
        'defaults' => [
            'free' => [
                'name' => 'Free',
                'price_monthly' => 0,
                'max_pages' => 1,
                'max_contacts' => 1000,
                'max_automations' => 3,
                'max_broadcasts_per_month' => 10,
                'features' => ['Welcome message', 'Auto replies', 'Comment automation', 'Basic analytics'],
            ],
            'growth' => [
                'name' => 'Growth',
                'price_monthly' => 29,
                'max_pages' => 5,
                'max_contacts' => 25000,
                'max_automations' => 50,
                'max_broadcasts_per_month' => 100,
                'features' => ['Everything in Free', 'Keyword automations', 'Broadcast scheduling', 'Click tracking', 'CSV export'],
            ],
            'business' => [
                'name' => 'Business',
                'price_monthly' => 79,
                'max_pages' => 25,
                'max_contacts' => 250000,
                'max_automations' => 250,
                'max_broadcasts_per_month' => 1000,
                'features' => ['Everything in Growth', 'Priority queue', 'Team-ready roles', 'Advanced analytics'],
            ],
        ],
    ],

    /**
     * Account limits used when no explicit plan is attached (free tier).
     */
    'limits' => [
        'pages' => (int) env('DORLA_DEFAULT_FREE_PAGE_LIMIT', 1),
        'contacts' => (int) env('DORLA_DEFAULT_CONTACT_LIMIT', 1000),
        'automations' => 3,
        'broadcasts_per_month' => (int) env('DORLA_DEFAULT_MONTHLY_BROADCAST_LIMIT', 10),
    ],

    /**
     * Contact sources describing how a Messenger contact entered the database.
     */
    'contact_sources' => [
        'dm' => 'Direct message',
        'comment_reply' => 'Comment private reply',
        'postback' => 'Button / postback interaction',
        'broadcast' => 'Broadcast reply',
        'import' => 'Import',
    ],

    /**
     * Personalization variables supported by MessageTemplateService.
     */
    'template_variables' => [
        'first_name' => 'Subscriber first name (fallback: "there")',
        'full_name' => 'Subscriber full name (fallback: first name fallback)',
        'page_name' => 'Connected Facebook Page name',
        'business_name' => 'Business name configured in your account settings',
        'custom_field' => 'Named custom field, e.g. {{custom_field:city}}',
    ],

    /**
     * CTR definition used across analytics views.
     */
    'ctr_formula' => 'CTR = unique recipients who clicked / delivered messages x 100',
];
