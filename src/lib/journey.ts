export interface Run { city: string; from: string; to: string }
export interface JourneyStop { index: number; city: string; kind: 'start' | 'stop' | 'end'; from?: string; to?: string }

/** Turns the route overview (e.g. Bangalore, Bangkok, Phuket, Krabi, Bangkok, Bangalore) into stops, attaching each
 *  in-trip stop's dates from the itinerary's city runs in order (so the two Bangkok visits get their own dates). */
export function buildJourney(route: string[], runs: Run[]): JourneyStop[] {
  const n = route.length
  let j = 0
  return route.map((city, index) => {
    const kind: JourneyStop['kind'] = n > 1 && index === 0 ? 'start' : n > 1 && index === n - 1 ? 'end' : 'stop'
    if (kind !== 'stop') return { index, city, kind }
    const hit = runs.findIndex((r, k) => k >= j && r.city.trim().toLowerCase() === city.trim().toLowerCase())
    if (hit === -1) return { index, city, kind }
    j = hit + 1
    return { index, city, kind, from: runs[hit].from, to: runs[hit].to }
  })
}

/** Where the group is: at the start before the trip, at the stop whose dates contain today during it, home afterwards. */
export function currentStopIndex(journey: JourneyStop[], startDate: string, endDate: string, today: string): number {
  if (journey.length === 0 || today < startDate) return 0
  if (today > endDate) return journey.length - 1
  const inside = journey.find((s) => s.from && s.to && s.from <= today && today <= s.to)
  if (inside) return inside.index
  let last = 0   // between visits (e.g. a travel day): stay at the most recent stop that has begun
  for (const s of journey) if (s.from && s.from <= today) last = s.index
  return last
}

export const isoToday = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
