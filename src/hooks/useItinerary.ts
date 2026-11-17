import { supabase, unwrap } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/offlineCache'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { Accommodation, Activity, Day, Transport } from '@/lib/types'

interface ItineraryData { days: Day[]; acts: Activity[]; acc: Accommodation[]; tr: Transport[]; counts: Record<string, number> }

export function useItinerary(tripId: string) {
  const { session } = useAuth()
  const uid = session!.user.id
  const q = useAsync(async () => {
    try {
      const [days, acts, acc, tr, cm] = await Promise.all([
        supabase.from('itinerary_days').select('*').eq('trip_id', tripId).is('deleted_at', null).order('day_number'),
        supabase.from('itinerary_activities').select('*').eq('trip_id', tripId).is('deleted_at', null).order('sort_order'),
        supabase.from('accommodation_bookings').select('id,name,city,check_in,check_out,status,maps_url').eq('trip_id', tripId).is('deleted_at', null),
        supabase.from('transport_bookings').select('id,mode,operator,origin,destination,travel_date,time_note,status').eq('trip_id', tripId).is('deleted_at', null),
        supabase.from('comments').select('target_id').eq('trip_id', tripId).eq('target_type', 'activity').is('deleted_at', null),
      ])
      const counts: Record<string, number> = {}
      for (const c of unwrap(cm) as { target_id: string }[]) counts[c.target_id] = (counts[c.target_id] ?? 0) + 1
      const data: ItineraryData = { days: unwrap(days) as Day[], acts: unwrap(acts) as Activity[], acc: unwrap(acc) as Accommodation[], tr: unwrap(tr) as Transport[], counts }
      writeCache(uid, tripId, 'itinerary', data)
      return { ...data, savedAt: null as number | null }
    } catch (e) {
      // Offline (or backend unreachable): fall back to the last copy saved on this device, if any.
      const hit = readCache<ItineraryData>(uid, tripId, 'itinerary')
      if (hit) return { ...hit.data, savedAt: hit.savedAt as number | null }
      throw e
    }
  }, [tripId, uid])
  useRealtime(tripId, ['itinerary_days', 'itinerary_activities', 'accommodation_bookings', 'transport_bookings', 'comments'], q.reload)
  return q
}
