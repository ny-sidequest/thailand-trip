// Read-only offline copy of the itinerary for use without signal. Per user + trip, in localStorage,
// removed on sign-out. Never used for documents, receipts, expenses or personal data.
const PREFIX = 'tripHQ.cache.'
const key = (uid: string, tripId: string, name: string) => `${PREFIX}${uid}.${tripId}.${name}`

export interface Cached<T> { savedAt: number; data: T }

export function writeCache<T>(uid: string, tripId: string, name: string, data: T) {
  try { localStorage.setItem(key(uid, tripId, name), JSON.stringify({ savedAt: Date.now(), data } satisfies Cached<T>)) } catch { /* storage full / disabled: offline copy is optional */ }
}
export function readCache<T>(uid: string, tripId: string, name: string): Cached<T> | null {
  try { const raw = localStorage.getItem(key(uid, tripId, name)); return raw ? (JSON.parse(raw) as Cached<T>) : null } catch { return null }
}
export function clearAllCaches() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
}
