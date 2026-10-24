import { describe, it, expect } from 'vitest'
import { renderTemplate, clampMessage } from '../src/lib/template'
import { calcCtr } from '../src/lib/analytics'
import { keywordMatches, type Decision } from '../src/lib/eligibility'
import type { AutomationRule } from '@prisma/client'

describe('message personalization templates', () => {
  it('personalizes with first_name and page_name', () => {
    expect(renderTemplate('Hi {{first_name}}! Welcome to {{page_name}}.', { first_name: 'Sara', page_name: 'Acme' })).toBe(
      'Hi Sara! Welcome to Acme.'
    )
  })

  it('falls back to "there" when the name is missing', () => {
    expect(renderTemplate('Hi {{first_name}}!', {})).toBe('Hi there!')
    expect(renderTemplate('Hi {{first_name}}!', { first_name: '  ' })).toBe('Hi there!')
  })

  it('supports {{tracked_link}} and leaves unknown variables untouched', () => {
    expect(renderTemplate('See {{tracked_link}} now', { tracked_link: 'https://x.co/1' })).toBe('See https://x.co/1 now')
    expect(renderTemplate('Hi {{unknown_var}}', {})).toBe('Hi {{unknown_var}}')
  })

  it('clamps messages to Messenger limits', () => {
    expect(clampMessage('a'.repeat(3000), 1900)).toHaveLength(1900)
    expect(clampMessage('short')).toBe('short')
  })
})

describe('CTR calculations (honest denominators)', () => {
  it('uses delivered messages when delivery data exists', () => {
    expect(calcCtr(10, 200, 250)).toEqual({ ctr: 5, denominator: 'delivered' })
  })

  it('falls back to sent with a labeled denominator when delivery data is missing', () => {
    const r = calcCtr(10, 0, 200)
    expect(r.ctr).toBe(5)
    expect(r.denominator).toBe('sent')
  })

  it('returns null CTR when there is nothing to divide by', () => {
    expect(calcCtr(0, 0, 0)).toEqual({ ctr: null, denominator: null })
  })

  it('rounds to two decimals', () => {
    expect(calcCtr(1, 3, 0).ctr).toBe(33.33)
  })
})

describe('keyword matching (comment & default reply rules)', () => {
  const rule = (keyword: string, matchType: 'CONTAINS' | 'EXACT' | 'STARTS_WITH'): AutomationRule =>
    ({ id: 'r1', automationId: 'a1', keyword, matchType, isActive: true, createdAt: new Date() }) as AutomationRule

  it('matches CONTAINS case-insensitively', () => {
    expect(keywordMatches('What is the PRICE?', [rule('price', 'CONTAINS')]).matched).toBe(true)
    expect(keywordMatches('nothing here', [rule('price', 'CONTAINS')]).matched).toBe(false)
  })

  it('matches EXACT only on equality', () => {
    expect(keywordMatches('price', [rule('price', 'EXACT')]).matched).toBe(true)
    expect(keywordMatches('price list', [rule('price', 'EXACT')]).matched).toBe(false)
  })

  it('matches STARTS_WITH on the prefix', () => {
    expect(keywordMatches('price list', [rule('price', 'STARTS_WITH')]).matched).toBe(true)
    expect(keywordMatches('best price', [rule('price', 'STARTS_WITH')]).matched).toBe(false)
  })

  it('returns the matched rule for audit purposes', () => {
    const result = keywordMatches('hello support', [rule('hours', 'CONTAINS'), rule('support', 'CONTAINS')])
    expect(result.matched).toBe(true)
    expect(result.rule?.keyword).toBe('support')
  })
})

describe('eligibility decision reasons', () => {
  it('documents the policy reasons used across the app', () => {
    const reasons: Decision['reason'][] = [
      'automation_paused',
      'page_not_connected',
      'comment_by_page',
      'outside_private_reply_window',
      'post_not_targeted',
      'keyword_not_matched',
      'already_replied',
      'ok',
    ]
    expect(new Set(reasons).size).toBe(reasons.length)
  })
})
