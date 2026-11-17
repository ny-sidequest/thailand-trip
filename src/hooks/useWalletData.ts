import { supabase, unwrap } from '@/lib/supabase'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { ActivityBookingLite, DocumentRow, StayFull, TransportFull } from '@/lib/types'

export function useWalletData(tripId: string) {
  const q = useAsync(async () => {
    const [docs, stays, tr, ab] = await Promise.all([
      supabase.from('documents').select('*').eq('trip_id', tripId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('accommodation_bookings').select('*').eq('trip_id', tripId).is('deleted_at', null).order('check_in'),
      supabase.from('transport_bookings').select('*').eq('trip_id', tripId).is('deleted_at', null).order('travel_date'),
      supabase.from('activity_bookings').select('id,name,booking_date').eq('trip_id', tripId).is('deleted_at', null).order('booking_date'),
    ])
    return {
      docs: unwrap(docs) as DocumentRow[], stays: unwrap(stays) as StayFull[],
      transport: unwrap(tr) as TransportFull[], activityBookings: unwrap(ab) as ActivityBookingLite[],
    }
  }, [tripId])
  useRealtime(tripId, ['documents', 'accommodation_bookings', 'transport_bookings', 'activity_bookings'], q.reload)
  return q
}
