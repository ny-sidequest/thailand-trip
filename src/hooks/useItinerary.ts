import { supabase, unwrap } from '@/lib/supabase'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { Accommodation, Activity, Day, Transport } from '@/lib/types'

export function useItinerary(tripId: string) {
  const q = useAsync(async () => {
    const [days, acts, acc, tr, cm] = await Promise.all([
      supabase.from('itinerary_days').select('*').eq('trip_id', tripId).is('deleted_at', null).order('day_number'),
      supabase.from('itinerary_activities').select('*').eq('trip_id', tripId).is('deleted_at', null).order('sort_order'),
      supabase.from('accommodation_bookings').select('id,name,city,check_in,check_out,status,maps_url').eq('trip_id', tripId).is('deleted_at', null),
      supabase.from('transport_bookings').select('id,mode,operator,origin,destination,travel_date,time_note,status').eq('trip_id', tripId).is('deleted_at', null),
      supabase.from('comments').select('target_id').eq('trip_id', tripId).eq('target_type', 'activity').is('deleted_at', null),
    ])
    const counts: Record<string, number> = {}
    for (const c of unwrap(cm) as { target_id: string }[]) counts[c.target_id] = (counts[c.target_id] ?? 0) + 1
    return {
      days: unwrap(days) as Day[], acts: unwrap(acts) as Activity[],
      acc: unwrap(acc) as Accommodation[], tr: unwrap(tr) as Transport[], counts,
    }
  }, [tripId])
  useRealtime(tripId, ['itinerary_days', 'itinerary_activities', 'accommodation_bookings', 'transport_bookings', 'comments'], q.reload)
  return q
}
