import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge } from '@/components/ui'
import EditRecordSheet, { type FieldSpec } from '@/components/EditRecordSheet'
import { KindIcon } from '@/components/KindIcon'
import { fmtDate, fmtTime, STATUS_LABEL } from '@/lib/format'
import type { Activity, BookingStatus, Day } from '@/lib/types'

const DAY_FIELDS: FieldSpec[] = [
  { key: 'day_date', label: 'Date', type: 'date', required: true }, { key: 'city', label: 'City', type: 'text', required: true, max: 80 },
  { key: 'title', label: 'Title', type: 'text', required: true, max: 160 }, { key: 'summary', label: 'Summary', type: 'textarea' },
  { key: 'image_url', label: 'Photo link', type: 'url', hint: 'Optional https link to a photo you have the rights to use.' },
]
const KINDS = [['activity', 'Activity'], ['food', 'Food'], ['transport', 'Transport'], ['stay', 'Stay'], ['flight', 'Flight'], ['option', 'Option'], ['free', 'Free time']].map(([value, label]) => ({ value, label }))
const statusOptions = (Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))
export const ACTIVITY_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', type: 'text', required: true, max: 160 }, { key: 'kind', label: 'Type', type: 'select', required: true, options: KINDS },
  { key: 'status', label: 'Booking status', type: 'select', required: true, options: statusOptions, hint: 'Only mark Confirmed when it is actually booked.' },
  { key: 'is_optional', label: 'Optional activity?', type: 'boolean' },
  { key: 'start_time', label: 'Start time', type: 'time' }, { key: 'end_time', label: 'End time', type: 'time' },
  { key: 'time_note', label: 'Time note', type: 'text', hint: 'e.g. "approx 17:00, unconfirmed"' }, { key: 'duration_text', label: 'Duration', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'location_name', label: 'Location name', type: 'text' }, { key: 'origin', label: 'From (journeys)', type: 'text' }, { key: 'destination', label: 'To (journeys)', type: 'text' },
  { key: 'maps_url', label: 'Google Maps link', type: 'url' }, { key: 'meeting_point', label: 'Meeting point', type: 'text' }, { key: 'pickup_info', label: 'Pickup / drop-off', type: 'text' },
  { key: 'transport_info', label: 'Transport', type: 'text' },
  { key: 'est_cost_amount', label: 'Estimated cost', type: 'number', hint: 'Leave empty if unknown. Never guess.' },
  { key: 'est_cost_currency', label: 'Cost currency', type: 'select', options: [{ value: 'THB', label: 'THB' }, { value: 'INR', label: 'INR' }] },
  { key: 'booking_ref', label: 'Booking reference', type: 'text', max: 80 }, { key: 'reminders', label: 'Reminders', type: 'textarea' },
]

export default function ItineraryAdmin() {
  const { dayId } = useParams()
  return dayId ? <DayAdmin dayId={dayId} /> : <DaysAdmin />
}

function DaysAdmin() {
  const { trip } = useTrip()
  const [edit, setEdit] = useState<Day | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const q = useAsync(async () => {
    const [d, a, all] = await Promise.all([
      supabase.from('itinerary_days').select('*').eq('trip_id', trip!.id).is('deleted_at', null).order('day_date').order('day_number'),
      supabase.from('itinerary_activities').select('day_id').eq('trip_id', trip!.id).is('deleted_at', null),
      supabase.from('itinerary_days').select('day_number,day_date').eq('trip_id', trip!.id).order('day_number', { ascending: false }).limit(1),   // includes soft-deleted: numbers are never reused
    ])
    const counts: Record<string, number> = {}
    for (const x of unwrap(a) as { day_id: string }[]) counts[x.day_id] = (counts[x.day_id] ?? 0) + 1
    return { days: unwrap(d) as Day[], counts, last: (unwrap(all) as { day_number: number; day_date: string }[])[0] }
  }, [trip!.id])

  async function del(d: Day) {
    if (!confirm(`Delete Day ${d.day_number} (${d.city}) and its ${q.data!.counts[d.id] ?? 0} activities?`)) return
    const { error } = await supabase.rpc('delete_day', { p_day: d.id })
    if (error) setErr(error.message); else q.reload()
  }
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <Skeleton className="h-64" />
  const nextDate = q.data.last ? new Date(Date.parse(q.data.last.day_date) + 86_400_000).toISOString().slice(0, 10) : trip!.start_date

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink-50">Itinerary</h1><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add day</Button></div>
      {err && <p role="alert" className="text-red-300">{err}</p>}
      {q.data.days.length === 0 ? <Card><EmptyState title="No days yet" hint="Add the first day." /></Card> : (
        <Card className="divide-y divide-white/10">
          {q.data.days.map((d) => (
            <div key={d.id} className="flex items-center gap-2 p-3">
              <Link to={`/admin/itinerary/${d.id}`} className="flex-1 min-w-0 flex items-center gap-3 min-h-[56px]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 text-ink-50 font-semibold">{d.day_number}</span>
                <span className="min-w-0"><span className="block font-semibold text-ink-50 truncate">{d.title}</span><span className="block text-sm text-ink-300">{fmtDate(d.day_date)} · {d.city} · {q.data!.counts[d.id] ?? 0} activities</span></span>
                <ChevronRight className="h-4 w-4 text-ink-400 ml-auto shrink-0" />
              </Link>
              <button onClick={() => setEdit(d)} aria-label={`Edit day ${d.day_number}`} className="p-2 text-ink-400 hover:text-ink-50"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => void del(d)} aria-label={`Delete day ${d.day_number}`} className="p-2 text-ink-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      )}
      {edit && <EditRecordSheet title={edit === 'new' ? 'Add day' : `Edit day ${edit.day_number}`} table="itinerary_days" id={edit === 'new' ? undefined : edit.id} fields={DAY_FIELDS}
        initial={edit === 'new' ? { day_date: nextDate } : (edit as unknown as Record<string, unknown>)}
        insertDefaults={{ trip_id: trip!.id, day_number: (q.data.last?.day_number ?? 0) + 1, sort_order: (q.data.last?.day_number ?? 0) + 1 }}
        onClose={() => setEdit(null)} onSaved={q.reload} />}
    </div>
  )
}

function DayAdmin({ dayId }: { dayId: string }) {
  const { session } = useAuth()
  const { trip } = useTrip()
  const [edit, setEdit] = useState<Activity | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const q = useAsync(async () => {
    const [d, a] = await Promise.all([
      supabase.from('itinerary_days').select('*').eq('id', dayId).maybeSingle(),
      supabase.from('itinerary_activities').select('*').eq('day_id', dayId).is('deleted_at', null).order('sort_order'),
    ])
    return { day: unwrap(d) as Day | null, acts: unwrap(a) as Activity[] }
  }, [dayId])

  async function move(i: number, dir: -1 | 1) {
    const ids = q.data!.acts.map((a) => a.id)
    ;[ids[i], ids[i + dir]] = [ids[i + dir], ids[i]]
    const { error } = await supabase.rpc('reorder_activities', { p_day: dayId, p_ids: ids })
    if (error) setErr(error.message); else q.reload()
  }
  async function del(a: Activity) {
    if (!confirm(`Delete “${a.title}”? Its comments stay in the database but are hidden with it.`)) return
    const { error } = await supabase.from('itinerary_activities').update({ deleted_at: new Date().toISOString() }).eq('id', a.id)
    if (error) setErr(error.message); else q.reload()
  }
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <Skeleton className="h-64" />
  const { day, acts } = q.data
  if (!day) return <p className="text-ink-200">Day not found.</p>
  const maxSort = acts.reduce((m, a) => Math.max(m, a.sort_order), 0)

  return (
    <div className="space-y-4 max-w-2xl">
      <Link to="/admin/itinerary" className="inline-flex items-center gap-1 text-jungle-300 font-semibold min-h-[44px]"><ArrowLeft className="h-4 w-4" />All days</Link>
      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ember-300">Day {day.day_number} · {fmtDate(day.day_date)}</p><h1 className="font-display text-2xl font-medium text-ink-50">{day.title}</h1></div><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add</Button></div>
      {err && <p role="alert" className="text-red-300">{err}</p>}
      {acts.length === 0 ? <Card><EmptyState title="No activities yet" /></Card> : (
        <Card className="divide-y divide-white/10">
          {acts.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 p-3">
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => void move(i, -1)} aria-label={`Move ${a.title} up`} className="p-1.5 text-ink-400 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                <button disabled={i === acts.length - 1} onClick={() => void move(i, 1)} aria-label={`Move ${a.title} down`} className="p-1.5 text-ink-400 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-jungle-500/10 text-jungle-300"><KindIcon kind={a.kind} className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-ink-50 truncate">{a.title}</p><p className="text-sm text-ink-300 truncate">{fmtTime(a.start_time) ?? a.time_note ?? 'Time TBC'}{a.is_optional ? ' · Optional' : ''}</p></div>
              <StatusBadge status={a.status} />
              <button onClick={() => setEdit(a)} aria-label={`Edit ${a.title}`} className="p-2 text-ink-400 hover:text-ink-50"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => void del(a)} aria-label={`Delete ${a.title}`} className="p-2 text-ink-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      )}
      {edit && <EditRecordSheet title={edit === 'new' ? 'Add activity' : 'Edit activity'} subtitle={edit === 'new' ? undefined : edit.title} table="itinerary_activities" id={edit === 'new' ? undefined : edit.id}
        fields={ACTIVITY_FIELDS} stampUpdatedBy={edit !== 'new'}
        initial={edit === 'new' ? { kind: 'activity', status: 'suggested', is_optional: false } : (edit as unknown as Record<string, unknown>)}
        insertDefaults={{ trip_id: trip!.id, day_id: dayId, sort_order: maxSort + 1, created_by: session!.user.id }}
        onClose={() => setEdit(null)} onSaved={q.reload} />}
    </div>
  )
}
