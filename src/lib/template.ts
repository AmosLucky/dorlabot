/**
 * Message personalization templates.
 * Supported variables: {{first_name}}, {{last_name}}, {{full_name}}, {{page_name}}
 * Missing values fall back to "there" for names, per brief.
 */

export type TemplateVars = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  page_name?: string | null
  tracked_link?: string | null
}

const NAME_FALLBACK = 'there'

export function renderTemplate(template: string, vars: TemplateVars): string {
  const firstName = (vars.first_name || '').trim()
  const lastName = (vars.last_name || '').trim()
  const fullName = (vars.full_name || `${firstName} ${lastName}`.trim()).trim()
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName || NAME_FALLBACK)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName || '')
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName || NAME_FALLBACK)
    .replace(/\{\{\s*page_name\s*\}\}/gi, (vars.page_name || '').trim() || 'our page')
    .replace(/\{\{\s*tracked_link\s*\}\}/gi, (vars.tracked_link || '').trim() || '')
    .replace(/\{\{\s*/g, '{{') // leave unknown variables untouched (visible for debugging)
    .trim()
}

export const SUPPORTED_VARIABLES = ['{{first_name}}', '{{last_name}}', '{{full_name}}', '{{page_name}}', '{{tracked_link}}'] as const

/** Facebook Messenger hard limit is 2000 chars for text messages; we cap conservatively. */
export function clampMessage(text: string, max = 1900): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
