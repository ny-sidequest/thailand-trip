import { mapsDirectionsUrl, mapsSearchUrl, safeUrl } from './format'
import type { Activity } from './types'

/** Best available navigation link for one activity: stored link → origin/destination route → place search. */
export function activityDirectionsUrl(a: Activity, city?: string): string | null {
  const stored = safeUrl(a.maps_url)
  if (stored) return stored
  const o = a.origin?.trim(), d = a.destination?.trim()
  if (o && d) return mapsDirectionsUrl([o, d], 'driving')
  const place = (a.location_name ?? d ?? o)?.trim()
  return place ? mapsSearchUrl(city && !place.toLowerCase().includes(city.toLowerCase()) ? `${place}, ${city}` : place) : null
}

/** One multi-stop route through the day's named places, in timeline order (Google Maps allows ~9 waypoints). */
export function dayRouteUrl(acts: Activity[], city: string): string | null {
  const stops: string[] = []
  for (const a of acts) {
    if (a.is_optional || a.kind === 'option' || a.status === 'cancelled') continue
    const p = a.location_name?.trim()
    if (p && !stops.includes(p)) stops.push(p)
  }
  if (stops.length === 0) return null
  const named = stops.slice(0, 10).map((s) => (s.toLowerCase().includes(city.toLowerCase()) ? s : `${s}, ${city}`))
  return mapsDirectionsUrl(named, 'driving')
}
