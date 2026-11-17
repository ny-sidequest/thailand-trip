import { describe, it, expect } from 'vitest'
import { dueState, groupByCategory, nextDeadline, pct } from './checklist'
import type { ChecklistItem } from './types'

const it_ = (id: string, category: string, sort_order: number, due_date: string | null = null) =>
  ({ id, category, sort_order, due_date, title: id, description: null }) as ChecklistItem
const now = new Date(2026, 11, 10)

describe('checklist helpers', () => {
  it('groups by category in sort order', () => {
    const g = groupByCategory([it_('b', 'Packing', 5), it_('a', 'Docs', 1), it_('c', 'Docs', 2)])
    expect(g.map((x) => x.category)).toEqual(['Docs', 'Packing']); expect(g[0].items.map((x) => x.id)).toEqual(['a', 'c'])
  })
  it('percentages handle zero and rounding', () => { expect(pct(0, 0)).toBe(0); expect(pct(1, 3)).toBe(33); expect(pct(2, 3)).toBe(67) })
  it('due states', () => {
    expect(dueState(null, false, now)).toBe('none'); expect(dueState('2026-12-01', true, now)).toBe('done')
    expect(dueState('2026-12-09', false, now)).toBe('overdue'); expect(dueState('2026-12-12', false, now)).toBe('soon')
    expect(dueState('2026-12-20', false, now)).toBe('later')
  })
  it('next deadline ignores completed items', () => {
    const items = [it_('a', 'x', 1, '2026-12-05'), it_('b', 'x', 2, '2026-12-08'), it_('c', 'x', 3)]
    expect(nextDeadline(items, new Set(['a']))?.id).toBe('b'); expect(nextDeadline(items, new Set(['a', 'b']))).toBeNull()
  })
})
