import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Button, Card, EmptyState, ErrorState, Skeleton, StatusBadge, cx } from '@/components/ui'
import EditRecordSheet, { type FieldSpec } from '@/components/EditRecordSheet'
import { STAY_FIELDS, TRANSPORT_FIELDS } from '@/components/wallet/BookingCards'
import { fmtDate, STATUS_LABEL } from '@/lib/format'
import type { BookingStatus } from '@/lib/types'

type Kind = 'stays' | 'transport' | 'activities'
const TABS: { key: Kind; label: string }[] = [{ key: 'stays', label: 'Stays' }, { key: 'transport', label: 'Transport' }, { key: 'activities', label: 'Activities' }]
const statusOptions = (Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))

interface Row { id: string; status: BookingStatus; [k: string]: unknown }

export default function BookingsAdmin() {
  const { kind: k } = useParams()
  const kind: Kind = k === 'transport' || k === 'activities' ? k : 'stays'
  const { trip } = useTrip()
  const { session } = useAuth()
  const [edit, setEdit] = useState<Row | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const cfg = {
    stays: { table: 'accommodation_bookings', fields: STAY_FIELDS, order: 'check_in', title: (r: Row) => String(r.name), sub: (r: Row) => [r.city, r.check_in && fmtDate(String(r.check_in)) + (r.check_out ? ' → ' + fmtDate(String(r.check_out)) : '')].filter(Boolean).join(' · '), blank: { status: 'pending' } },
    transport: { table: 'transport_bookings', fields: TRANSPORT_FIELDS, order: 'travel_date', title: (r: Row) => `${r.origin} → ${r.destination}`, sub: (r: Row) => [r.mode, r.operator, r.travel_date && fmtDate(String(r.travel_date))].filter(Boolean).join(' · '), blank: { status: 'pending', mode: 'bus' } },
    activities: { table: 'activity_bookings', order: 'booking_date', title: (r: Row) => String(r.name), sub: (r: Row) => [r.operator, r.booking_date && fmtDate(String(r.booking_date))].filter(Boolean).join(' · '), blank: { status: 'pending' }, fields: [] as FieldSpec[] },
  }[kind]

  const q = useAsync(async () => {
    const [rows, acts] = await Promise.all([
      supabase.from(cfg.table).select('*').eq('trip_id', trip!.id).is('deleted_at', null).order(cfg.order),
      supabase.from('itinerary_activities').select('id,title').eq('trip_id', trip!.id).is('deleted_at', null).order('title'),
    ])
    return { rows: unwrap(rows) as unknown as Row[], acts: unwrap(acts) as { id: string; title: string }[] }
  }, [trip!.id, kind])

  const fields: FieldSpec[] = kind !== 'activities' ? cfg.fields : [
    { key: 'status', label: 'Booking status', type: 'select', required: true, options: statusOptions, hint: 'Only mark Confirmed when it is actually booked.' },
    { key: 'name', label: 'Name', type: 'text', required: true, max: 160 }, { key: 'operator', label: 'Operator', type: 'text' },
    { key: 'activity_id', label: 'Linked itinerary activity', type: 'select', options: (q.data?.acts ?? []).map((a) => ({ value: a.id, label: a.title })), hint: 'Shows this booking on the activity page.' },
    { key: 'booking_date', label: 'Date', type: 'date' }, { key: 'start_time', label: 'Start time', type: 'time' }, { key: 'booking_ref', label: 'Booking reference', type: 'text', max: 80 },
    { key: 'meeting_point', label: 'Meeting point', type: 'text' }, { key: 'pickup_info', label: 'Pickup / drop-off', type: 'text' },
    { key: 'price_amount', label: 'Price', type: 'number', hint: 'Leave empty if unknown.' }, { key: 'price_currency', label: 'Price currency', type: 'select', options: [{ value: 'THB', label: 'THB' }, { value: 'INR', label: 'INR' }] },
    { key: 'contact', label: 'Contact', type: 'text' }, { key: 'notes', label: 'Notes', type: 'textarea' },
  ]

  async function del(r: Row) {
    if (!confirm(`Delete “${cfg.title(r)}”?`)) return
    const { error } = await supabase.from(cfg.table).update({ deleted_at: new Date().toISOString() }).eq('id', r.id)
    if (error) setErr(error.message); else q.reload()
  }
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight text-navy-800">Bookings</h1><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add</Button></div>
      <nav className="flex gap-2 glass rounded-2xl p-1.5">
        {TABS.map((t) => <Link key={t.key} to={t.key === 'stays' ? '/admin/bookings' : `/admin/bookings/${t.key}`} aria-current={kind === t.key ? 'page' : undefined} className={cx('flex-1 text-center rounded-xl min-h-[44px] grid place-items-center font-semibold', kind === t.key ? 'bg-gradient-to-b from-navy-600 to-navy-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_6px_14px_-6px_rgba(11,31,58,.65)]' : 'text-navy-600 hover:bg-sand-100')}>{t.label}</Link>)}
      </nav>
      {err && <p role="alert" className="text-red-700">{err}</p>}
      {!q.data ? <Skeleton className="h-48" /> : q.data.rows.length === 0 ? <Card><EmptyState title="Nothing here yet" /></Card> : (
        <Card className="divide-y divide-sand-200/70">
          {q.data.rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-3 min-h-[64px]">
              <div className="min-w-0 flex-1"><p className="font-semibold text-navy-800 truncate">{cfg.title(r)}</p><p className="text-sm text-navy-500 truncate">{cfg.sub(r)}</p></div>
              <StatusBadge status={r.status} />
              <button onClick={() => setEdit(r)} aria-label="Edit" className="p-2 text-navy-400 hover:text-navy-800"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => void del(r)} aria-label="Delete" className="p-2 text-navy-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </Card>
      )}
      {edit && <EditRecordSheet key={kind + (edit === 'new' ? 'new' : edit.id)} title={edit === 'new' ? 'Add booking' : 'Edit booking'} table={cfg.table} id={edit === 'new' ? undefined : edit.id} fields={fields}
        initial={edit === 'new' ? cfg.blank : edit} insertDefaults={{ trip_id: trip!.id, created_by: session!.user.id }} onClose={() => setEdit(null)} onSaved={q.reload} />}
    </div>
  )
}
