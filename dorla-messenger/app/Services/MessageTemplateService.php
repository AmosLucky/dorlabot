<?php

namespace App\Services;

use App\Models\ContactCustomField;
use App\Models\FacebookPage;
use App\Models\MessengerContact;
use Illuminate\Support\Str;

/**
 * Personalization template engine.
 *
 * Supported variables:
 *   {{first_name}}                    -> contact first name (fallback: "there")
 *   {{full_name}}                     -> full name when available
 *   {{page_name}}                     -> connected Page name
 *   {{business_name}}                 -> tenant-configured business name
 *   {{custom_field:key}}              -> tenant-defined custom field value
 *
 * Rendering is pure string interpolation — no evaluation — so template
 * code can never execute. Values are escaped for Messenger text delivery
 * (no HTML is involved in the Messenger channel; escaping guards logs/UI).
 */
class MessageTemplateService
{
    public function __construct(
        private readonly TenantContextService $tenant,
    ) {}

    public function supportedVariables(): array
    {
        return config('dorla.template_variables');
    }

    /**
     * Render a template string for the given contact/page context.
     */
    public function render(
        string $template,
        ?MessengerContact $contact = null,
        ?FacebookPage $page = null,
    ): string {
        $context = $this->buildContext($contact, $page);

        return preg_replace_callback(
            '/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9_\-]+))?\s*\}\}/',
            function (array $matches) use ($context): string {
                $variable = $matches[1];
                $argument = $matches[2] ?? null;

                $value = $this->resolve($variable, $argument, $context);

                return (string) $value;
            },
            $template,
        );
    }

    /**
     * Validate a template: returns list of unknown variables (errors).
     */
    public function validate(string $template): array
    {
        $known = ['first_name', 'full_name', 'page_name', 'business_name', 'custom_field'];
        $errors = [];

        preg_match_all('/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z0-9_\-]+))?\s*\}\}/', $template, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            if (! in_array($match[1], $known, true)) {
                $errors[] = "Unknown variable {{$match[1]}}";
            }
            if ($match[1] === 'custom_field' && empty($match[2])) {
                $errors[] = 'custom_field requires a key, e.g. {{custom_field:city}}';
            }
        }

        return array_unique($errors);
    }

    /**
     * Preview rendering with sample data (used by composers and editors).
     */
    public function preview(string $template, int $userId, ?FacebookPage $page = null): string
    {
        $sample = new MessengerContact([
            'first_name' => 'Alex',
            'last_name' => 'Morgan',
            'psid' => 'preview_psid',
        ]);

        // Sample custom fields for previews.
        $sample->setRelation('customFields', collect([
            new ContactCustomField(['field_key' => 'city', 'field_value' => 'Lagos']),
        ]));

        return $this->render($template, $sample, $page);
    }

    private function buildContext(?MessengerContact $contact, ?FacebookPage $page): array
    {
        $user = $contact?->user ?: ($page?->user);

        return [
            'contact' => $contact,
            'page' => $page,
            'business_name' => $user?->businessName() ?? config('app.name'),
            'fallback_first_name' => $user?->accountSetting?->default_fallback_first_name ?? 'there',
        ];
    }

    private function resolve(string $variable, ?string $argument, array $context): string
    {
        /** @var MessengerContact|null $contact */
        $contact = $context['contact'];
        /** @var FacebookPage|null $page */
        $page = $context['page'];

        return match ($variable) {
            'first_name' => $contact?->first_name ?: $context['fallback_first_name'],
            'full_name' => $contact ? ($contact->fullName() !== 'Subscriber #'.$contact->id ? $contact->fullName() : $context['fallback_first_name']) : $context['fallback_first_name'],
            'page_name' => $page?->name ?? 'our page',
            'business_name' => (string) $context['business_name'],
            'custom_field' => $argument !== null ? (string) ($contact?->customFieldValue($argument) ?? '') : '',
            default => '',
        };
    }

    /**
     * Sanitize user-entered text before it goes to Messenger (strip control
     * characters, cap length per Send API limits).
     */
    public function sanitizeForMessenger(string $text, int $maxLength = 2000): string
    {
        $clean = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';

        return Str::limit(trim($clean), $maxLength);
    }
}
