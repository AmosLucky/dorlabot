import { z } from 'zod'

export const automationTypeSchema = z.enum(['COMMENT_REPLY', 'WELCOME_MESSAGE', 'DEFAULT_REPLY'])

export const ruleSchema = z.object({
  id: z.string().optional(),
  keyword: z.string().trim().min(1, 'Keyword cannot be empty').max(80),
  matchType: z.enum(['CONTAINS', 'EXACT', 'STARTS_WITH']).default('CONTAINS'),
  isActive: z.boolean().default(true),
})

export const automationUpsertSchema = z
  .object({
    pageId: z.string().min(1),
    type: automationTypeSchema,
    name: z.string().trim().min(1).max(120),
    replyTemplate: z.string().max(1900).default(''),
    fallbackReply: z.string().max(1900).optional().nullable(),
    matchMode: z.enum(['any', 'keywords', 'keywords+fallback']).default('any'),
    enabledPosts: z.array(z.string()).default(['ALL']),
    rules: z.array(ruleSchema).max(30).default([]),
    quickReplies: z
      .array(z.object({ title: z.string().trim().min(1).max(20), payload: z.string().max(500).optional() }))
      .max(3)
      .optional()
      .nullable(),
    status: z.enum(['ACTIVE', 'PAUSED']).default('PAUSED'),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'COMMENT_REPLY' && val.matchMode === 'keywords' && val.rules.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Add at least one keyword or switch the trigger to any comment.', path: ['rules'] })
    }
    if (val.type === 'WELCOME_MESSAGE' && !val.replyTemplate.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Welcome message text is required.', path: ['replyTemplate'] })
    }
    if (val.type === 'DEFAULT_REPLY') {
      if (val.rules.length === 0 && !val.fallbackReply?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Provide keyword rules, a fallback reply, or both.', path: ['rules'] })
      }
      if (val.rules.length > 0 && !val.replyTemplate.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Keyword reply text is required when keywords are configured.', path: ['replyTemplate'] })
      }
    }
    if (val.type === 'COMMENT_REPLY' && !val.replyTemplate.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Private reply text is required.', path: ['replyTemplate'] })
    }
  })

export type AutomationUpsertInput = z.infer<typeof automationUpsertSchema>
export type AutomationType = z.infer<typeof automationTypeSchema>
