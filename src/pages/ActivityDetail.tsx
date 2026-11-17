import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Banknote, Clock, Hash, MapPin, Navigation, Pencil, Route, Timer, Truck, Users } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { useRealtime } from '@/hooks/useRealtime'
import { Button, Card, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import { KindIcon } from '@/components/KindIcon'
import CommentThread from '@/components/CommentThread'
import EditActivitySheet from '@/components/EditActivitySheet'
import { fmtDateLong, fmtTime } from '@/lib/format'
import { activityDirectionsUrl } from '@/lib/maps'
import type { Activity, ActivityBooking, Day } from '@/lib/types'

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3">
      <span className="mt-0.5 text-navy-300 shrink-0">{icon}</span>
      <div className="min-w-0"><p className="text-sm font-semibold text-navy-400">{label}</p><p className="text-navy-800 break-words whitespace-pre-wrap">{children}</p></div>
    </div>
  )
}

export default function ActivityDetail() {
  const { id } = useParams()
  const { trip, isAdmin } = useTrip()
  const [editing, setEditing] = useState(false)
  const tripId = trip!.id

  const q = useAsync(async () => {
    const a = unwrap(await supabase.from('itinerary_activities').select('*').eq('id', id!).eq('trip_id', tripId).is('deleted_at', null).maybeSingle()) as Activity | null
    if (!a) return null
    const [day, bk] = await Promise.all([
      supabase.from('itinerary_days').select('*').eq('id', a.day_id).single(),
      supabase.from('activity_bookings').select('id,name,operator,booking_ref,status,meeting_point,pickup_info,contact,notes').eq('activity_id', a.id).is('deleted_at', null),
    ])
    return { a, day: unwrap(day) as Day, bookings: unwrap(bk) as ActivityBooking[] }
  }, [id, tripId])
  useRealtime(tripId, ['itinerary_activities', 'activity_bookings'], q.reload)

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data && q.loading) return <div className="space-y-4"><Skeleton className="h-10 w-40" /><Skeleton className="h-64" /></div>
  if (!q.data) return (
    <div className="space-y-3"><Link to="/itinerary" className="inline-flex items-center gap-1 text-jungle-700 font-semibold min-h-[44px]"><ArrowLeft className="h-4 w-4" />Itinerary</Link><p className="text-navy-600">This activity no longer exists.</p></div>
  )
  const { a, day, bookings } = q.data
  const nav = activityDirectionsUrl(a, day.city)
  const time = [fmtTime(a.start_time) && (fmtTime(a.end_time) ? `${fmtTime(a.start_time)}–${fmtTime(a.end_time)}` : fmtTime(a.start_time)), a.time_note].filter(Boolean).join(' · ')
  const cost = a.est_cost_amount != null && a.est_cost_currency ? `≈ ${a.est_cost_amount.toLocaleString()} ${a.est_cost_currency}` : null

  return (
    <div className="space-y-5 max-w-2xl">
      <Link to={`/itinerary/day/${day.day_number}`} className="inline-flex items-center gap-1 text-jungle-700 font-semibold min-h-[44px]"><ArrowLeft className="h-4 w-4" />Day {day.day_number} · {day.city}</Link>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-jungle-50 text-jungle-700"><KindIcon kind={a.kind} className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ember-600">{fmtDateLong(day.day_date)}</p>
            <h1 className="font-display text-2xl font-bold text-navy-800 leading-tight">{a.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              {a.is_optional && <span className="rounded-full bg-ember-100 text-ember-600 px-2.5 py-0.5 text-sm font-semibold">Optional</span>}
            </div>
          </div>
        </div>
        {a.description && <p className="mt-4 text-navy-700 whitespace-pre-wrap">{a.description}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          {nav && <a href={nav} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-jungle-600 text-white px-4 min-h-[44px] font-semibold hover:bg-jungle-700"><Navigation className="h-4 w-4" />Directions</a>}
          {isAdmin && <Button variant="soft" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>}
        </div>
      </Card>

      {a.reminders && (
        <div className="rounded-2xl bg-ember-50 border border-ember-100 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-ember-600 shrink-0 mt-0.5" />
          <div><p className="font-semibold text-navy-800">Reminder</p><p className="text-navy-700 whitespace-pre-wrap">{a.reminders}</p></div>
        </div>
      )}

      <Card className="px-5 divide-y divide-sand-200/70">
        <Row icon={<Clock className="h-5 w-5" />} label="Time">{time || 'To be confirmed'}</Row>
        {a.duration_text && <Row icon={<Timer className="h-5 w-5" />} label="Duration">{a.duration_text}</Row>}
        {a.location_name && <Row icon={<MapPin className="h-5 w-5" />} label="Location">{a.location_name}</Row>}
        {(a.origin || a.destination) && <Row icon={<Route className="h-5 w-5" />} label="Journey">{[a.origin, a.destination].filter(Boolean).join(' → ')}</Row>}
        {a.transport_info && <Row icon={<Truck className="h-5 w-5" />} label="Transport">{a.transport_info}</Row>}
        {a.meeting_point && <Row icon={<Users className="h-5 w-5" />} label="Meeting point">{a.meeting_point}</Row>}
        {a.pickup_info && <Row icon={<Truck className="h-5 w-5" />} label="Pickup / drop-off">{a.pickup_info}</Row>}
        {cost && <Row icon={<Banknote className="h-5 w-5" />} label="Estimated cost">{cost}</Row>}
        {a.booking_ref && <Row icon={<Hash className="h-5 w-5" />} label="Booking reference">{a.booking_ref}</Row>}
      </Card>

      {bookings.length > 0 && (
        <Card className="divide-y divide-sand-200/70">
          {bookings.map((b) => (
            <div key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold text-navy-800">{b.name}</p><StatusBadge status={b.status} /></div>
              <p className="text-navy-600 text-sm">{[b.operator, b.booking_ref && `Ref ${b.booking_ref}`, b.contact].filter(Boolean).join(' · ')}</p>
              {b.notes && <p className="text-navy-600 mt-1">{b.notes}</p>}
            </div>
          ))}
        </Card>
      )}

      <Card className="p-5"><CommentThread targetType="activity" targetId={a.id} /></Card>

      {editing && <EditActivitySheet activity={a} onClose={() => setEditing(false)} onSaved={q.reload} />}
    </div>
  )
}
