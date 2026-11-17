import { describe, it, expect } from 'vitest'
import { daysUntil, mapsDirectionsUrl, safeUrl, cityRuns, fmtDate } from './format'

describe('format helpers', () => {
  it('counts whole days regardless of time of day', () => {
    expect(daysUntil('2026-12-28', new Date(2026, 10, 17, 23, 59))).toBe(41)
    expect(daysUntil('2026-12-28', new Date(2026, 11, 28, 0, 1))).toBe(0)
  })
  it('formats dates without timezone drift', () => { expect(fmtDate('2026-12-28')).toBe('28 Dec') })
  it('builds multi-stop directions', () => {
    const u = mapsDirectionsUrl(['A', 'B', 'C', 'D'])
    expect(u).toContain('origin=A'); expect(u).toContain('destination=D'); expect(u).toContain('waypoints=B%7CC')
  })
  it('rejects non-http links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull(); expect(safeUrl('https://maps.google.com')).not.toBeNull()
  })
  it('collapses consecutive cities', () => {
    const runs = cityRuns([
      { city: 'Bangkok', day_date: '2026-12-28', image_url: null }, { city: 'Bangkok', day_date: '2026-12-29', image_url: null },
      { city: 'Phuket', day_date: '2026-12-31', image_url: null }, { city: 'Bangkok', day_date: '2027-01-06', image_url: null }])
    expect(runs.map((r) => r.city)).toEqual(['Bangkok', 'Phuket', 'Bangkok']); expect(runs[0].to).toBe('2026-12-29')
  })
})
