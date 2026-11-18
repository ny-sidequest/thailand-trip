import { describe, it, expect } from 'vitest'
import { buildJourney, currentStopIndex } from './journey'

const route = ['Bangalore', 'Bangkok', 'Phuket', 'Krabi', 'Bangkok', 'Bangalore']
const runs = [
  { city: 'Bangkok', from: '2026-12-28', to: '2026-12-30' }, { city: 'Phuket', from: '2026-12-31', to: '2027-01-01' },
  { city: 'Krabi', from: '2027-01-02', to: '2027-01-05' }, { city: 'Bangkok', from: '2027-01-06', to: '2027-01-07' },
]
const J = buildJourney(route, runs)

describe('journey', () => {
  it('marks start and end, and gives each Bangkok visit its own dates', () => {
    expect(J.map((s) => s.kind)).toEqual(['start', 'stop', 'stop', 'stop', 'stop', 'end'])
    expect(J[1].from).toBe('2026-12-28'); expect(J[4].from).toBe('2027-01-06'); expect(J[0].from).toBeUndefined(); expect(J[5].from).toBeUndefined()
  })
  it('copes with city names that differ in case or spacing, and with stops that have no itinerary days', () => {
    const j = buildJourney(['Home', ' bangkok ', 'Koh Samui', 'Home'], [{ city: 'Bangkok', from: 'a', to: 'b' }])
    expect(j[1].from).toBe('a'); expect(j[2].from).toBeUndefined()
  })
  it('a one-stop route is not both start and end', () => { expect(buildJourney(['Bangkok'], []).map((s) => s.kind)).toEqual(['stop']) })
  it('before the trip the group is in the car at the start (Bangalore)', () => { expect(currentStopIndex(J, '2026-12-28', '2027-01-07', '2026-11-18')).toBe(0) })
  it('moves along the road as the trip progresses', () => {
    const at = (d: string) => currentStopIndex(J, '2026-12-28', '2027-01-07', d)
    expect(at('2026-12-28')).toBe(1); expect(at('2026-12-30')).toBe(1); expect(at('2026-12-31')).toBe(2)
    expect(at('2027-01-03')).toBe(3); expect(at('2027-01-06')).toBe(4); expect(at('2027-01-07')).toBe(4)
  })
  it('after the trip the group is home', () => { expect(currentStopIndex(J, '2026-12-28', '2027-01-07', '2027-01-08')).toBe(5) })
  it('a gap between visits keeps the group at the last stop that began', () => {
    const gap = buildJourney(route, [runs[0], { ...runs[1], from: '2027-01-01', to: '2027-01-01' }, ...runs.slice(2)])
    expect(currentStopIndex(gap, '2026-12-28', '2027-01-07', '2026-12-31')).toBe(1)
  })
  it('empty journey is safe', () => { expect(currentStopIndex([], 'a', 'b', 'c')).toBe(0) })
})
