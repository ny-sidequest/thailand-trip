import { describe, it, expect } from 'vitest'
import { activityDirectionsUrl, dayRouteUrl } from './maps'
import type { Activity } from './types'

const base = { id: '1', title: 't', is_optional: false, kind: 'activity', status: 'suggested' } as Activity
describe('maps helpers', () => {
  it('prefers a stored https link', () => {
    expect(activityDirectionsUrl({ ...base, maps_url: 'https://maps.app.goo.gl/x', location_name: 'Y' })).toBe('https://maps.app.goo.gl/x')
  })
  it('ignores an unsafe stored link and falls back', () => {
    const u = activityDirectionsUrl({ ...base, maps_url: 'javascript:alert(1)', location_name: 'Wat Arun' } as Activity, 'Bangkok')
    expect(u).toContain('google.com/maps/search'); expect(u).toContain('Wat%20Arun%2C%20Bangkok')
  })
  it('builds a route when origin and destination exist', () => {
    expect(activityDirectionsUrl({ ...base, origin: 'A', destination: 'B' } as Activity)).toContain('origin=A&destination=B')
  })
  it('returns null with no location data', () => { expect(activityDirectionsUrl(base)).toBeNull() })
  it('day route skips optional and cancelled stops and dedupes', () => {
    const u = dayRouteUrl([
      { ...base, location_name: 'Talat Noi' }, { ...base, location_name: 'Talat Noi' },
      { ...base, location_name: 'Wat Arun' }, { ...base, location_name: 'Club', is_optional: true },
      { ...base, location_name: 'Gone', status: 'cancelled' }] as Activity[], 'Bangkok')
    expect(u).toContain('origin=Talat%20Noi%2C%20Bangkok'); expect(u).toContain('destination=Wat%20Arun%2C%20Bangkok')
    expect(u).not.toContain('Club'); expect(u).not.toContain('Gone')
  })
  it('day route is null with no places', () => { expect(dayRouteUrl([base], 'X')).toBeNull() })
})
