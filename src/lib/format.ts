import type { BookingStatus } from './types'

/** Parse 'YYYY-MM-DD' as a local calendar date (no timezone shift). */
export function parseDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}
export const fmtDate = (d: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  parseDate(d).toLocaleDateString('en-GB', o)
export const fmtDateLong = (d: string) => fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtTime = (t: string | null) => (t ? t.slice(0, 5) : null)

export function daysUntil(d: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDate(d).getTime() - today.getTime()) / 86_400_000)
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', pending: 'Pending', suggested: 'Suggested',
  needs_verification: 'Needs verification', cancelled: 'Cancelled', completed: 'Completed',
}

/** Only allow http(s) links from user-entered data. */
export const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null)

export const mapsSearchUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

/** Multi-stop Google Maps directions (no API key needed). */
export function mapsDirectionsUrl(stops: string[], mode: 'driving' | 'walking' | 'transit' = 'driving') {
  if (stops.length < 2) return mapsSearchUrl(stops[0] ?? '')
  const [origin, ...rest] = stops
  const destination = rest[rest.length - 1]
  const waypoints = rest.slice(0, -1)
  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`
  if (waypoints.length) url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`
  return url
}

/** Collapse consecutive duplicate stops of an itinerary into ordered city runs with date ranges. */
export function cityRuns(days: { city: string; day_date: string; image_url: string | null }[]) {
  const runs: { city: string; from: string; to: string; image_url: string | null }[] = []
  for (const d of days) {
    const last = runs[runs.length - 1]
    if (last && last.city === d.city) last.to = d.day_date
    else runs.push({ city: d.city, from: d.day_date, to: d.day_date, image_url: d.image_url })
  }
  return runs
}

/** Time left until local midnight at the start of `startDate`, or trip-progress once it has begun. */
export function tripClock(startDate: string, endDate: string, now = new Date()) {
  const start = parseDate(startDate).getTime()
  const end = parseDate(endDate).getTime() + 86_400_000
  const t = now.getTime()
  if (t >= end) return { state: 'over' as const }
  if (t >= start) {
    const day = Math.floor((t - start) / 86_400_000) + 1
    const total = Math.round((end - start) / 86_400_000)
    return { state: 'during' as const, day, total }
  }
  const ms = start - t
  return { state: 'before' as const, days: Math.floor(ms / 86_400_000), hours: Math.floor((ms % 86_400_000) / 3_600_000), minutes: Math.floor((ms % 3_600_000) / 60_000) }
}
