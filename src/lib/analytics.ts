/**
 * Pure analytics calculations (unit-tested in tests/analytics.test.ts).
 *
 * CTR definition: unique tracked clickers ÷ delivered messages × 100.
 * If delivery events are unavailable, the caller may pass `sent` as an
 * alternative denominator — which must be clearly labeled downstream.
 */

export type CtrResult = { ctr: number | null; denominator: 'delivered' | 'sent' | null }

export function calcCtr(uniqueClickers: number, delivered: number, sent: number): CtrResult {
  if (delivered > 0) {
    return { ctr: round2((uniqueClickers / delivered) * 100), denominator: 'delivered' }
  }
  if (sent > 0) {
    return { ctr: round2((uniqueClickers / sent) * 100), denominator: 'sent' }
  }
  return { ctr: null, denominator: null }
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}
