import { describe, it, expect } from 'vitest'
import { feedLink, groupReactions, pollClosed, pollResults, rkey } from './social'

describe('social helpers', () => {
  it('groups reactions per target and emoji', () => {
    const m = groupReactions([
      { target_type: 'feed', target_id: 'a', user_id: 'u1', emoji: '🔥' }, { target_type: 'feed', target_id: 'a', user_id: 'u2', emoji: '🔥' },
      { target_type: 'feed', target_id: 'a', user_id: 'u1', emoji: '❤️' }, { target_type: 'comment', target_id: 'a', user_id: 'u3', emoji: '👍' }])
    expect(m.get(rkey('feed', 'a'))!['🔥']).toEqual(['u1', 'u2']); expect(m.get(rkey('feed', 'a'))!['❤️']).toEqual(['u1'])
    expect(m.get(rkey('comment', 'a'))!['👍']).toEqual(['u3']); expect(m.get(rkey('feed', 'zzz'))).toBeUndefined()
  })
  it('poll closed by closed_at or by deadline', () => {
    const now = Date.parse('2026-12-01T12:00:00Z')
    expect(pollClosed({ closed_at: null, closes_at: null }, now)).toBe(false)
    expect(pollClosed({ closed_at: '2026-11-30T00:00:00Z', closes_at: null }, now)).toBe(true)
    expect(pollClosed({ closed_at: null, closes_at: '2026-12-01T11:00:00Z' }, now)).toBe(true)
    expect(pollClosed({ closed_at: null, closes_at: '2026-12-01T13:00:00Z' }, now)).toBe(false)
  })
  it('poll results: counts, voters and percent of voters', () => {
    const o = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const r = pollResults(o, [{ option_id: 'a', user_id: '1' }, { option_id: 'b', user_id: '1' }, { option_id: 'a', user_id: '2' }, { option_id: 'a', user_id: '3' }, { option_id: 'zzz', user_id: '9' }])
    expect(r.counts).toEqual({ a: 3, b: 1, c: 0 }); expect(r.voters).toBe(3); expect(r.percent).toEqual({ a: 100, b: 33, c: 0 })
  })
  it('poll results with no votes are all zero', () => { expect(pollResults([{ id: 'a' }], []).percent).toEqual({ a: 0 }) })
  it('feed links', () => {
    expect(feedLink('expense', 'expense', 'x')).toBe('/expenses'); expect(feedLink('comment', 'activity', 'abc')).toBe('/itinerary/activity/abc')
    expect(feedLink('post', null, null)).toBeNull(); expect(feedLink('poll', 'poll', 'p')).toBe('/feed/polls')
  })
})
