import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button, Field, inputCls } from '@/components/ui'
import { STATUS_LABEL, safeUrl } from '@/lib/format'
import type { Activity, BookingStatus } from '@/lib/types'

const nul = (s: string) => (s.trim() === '' ? null : s.trim())

/** Admin-only editor. Security is enforced by RLS (non-admin updates affect 0 rows); this is just the UI. */
export default function EditActivitySheet({ activity, onClose, onSaved }: { activity: Activity; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth()
  const [f, setF] = useState({
    status: activity.status as BookingStatus,
    start_time: activity.start_time?.slice(0, 5) ?? '', end_time: activity.end_time?.slice(0, 5) ?? '',
    time_note: activity.time_note ?? '', description: activity.description ?? '',
    location_name: activity.location_name ?? '', maps_url: activity.maps_url ?? '',
    meeting_point: activity.meeting_point ?? '', pickup_info: activity.pickup_info ?? '',
    booking_ref: activity.booking_ref ?? '', reminders: activity.reminders ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function save(e: FormEvent) {
    e.preventDefault()
    if (f.maps_url.trim() && !safeUrl(f.maps_url.trim())) return setErr('Map link must start with http:// or https://')
    setBusy(true); setErr(null)
    const { data, error } = await supabase.from('itinerary_activities').update({
      status: f.status, start_time: nul(f.start_time), end_time: nul(f.end_time), time_note: nul(f.time_note),
      description: nul(f.description), location_name: nul(f.location_name), maps_url: nul(f.maps_url),
      meeting_point: nul(f.meeting_point), pickup_info: nul(f.pickup_info), booking_ref: nul(f.booking_ref),
      reminders: nul(f.reminders), updated_by: session!.user.id,
    }).eq('id', activity.id).select('id')
    setBusy(false)
    if (error) return setErr(error.message)
    if (!data?.length) return setErr('Not saved: only the trip admin can edit activities.')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={save} role="dialog" aria-label="Edit activity" onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium text-ink-50">Edit activity</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-ink-300 -mt-2">{activity.title}</p>
        <Field label="Booking status" hint="Only mark Confirmed when it is actually booked.">
          <select className={inputCls} value={f.status} onChange={set('status')}>
            {(Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time"><input type="time" className={inputCls} value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="End time"><input type="time" className={inputCls} value={f.end_time} onChange={set('end_time')} /></Field>
        </div>
        <Field label="Time note" hint='e.g. "approx 17:00 (unconfirmed)"'><input className={inputCls} maxLength={120} value={f.time_note} onChange={set('time_note')} /></Field>
        <Field label="Description"><textarea className={`${inputCls} min-h-[80px] py-3`} value={f.description} onChange={set('description')} /></Field>
        <Field label="Location name"><input className={inputCls} maxLength={160} value={f.location_name} onChange={set('location_name')} /></Field>
        <Field label="Google Maps link" hint="Optional. Paste a share link; otherwise one is built from the place name."><input className={inputCls} inputMode="url" value={f.maps_url} onChange={set('maps_url')} /></Field>
        <Field label="Meeting point"><input className={inputCls} value={f.meeting_point} onChange={set('meeting_point')} /></Field>
        <Field label="Pickup / drop-off"><input className={inputCls} value={f.pickup_info} onChange={set('pickup_info')} /></Field>
        <Field label="Booking reference"><input className={inputCls} maxLength={80} value={f.booking_ref} onChange={set('booking_ref')} /></Field>
        <Field label="Reminders"><textarea className={`${inputCls} min-h-[72px] py-3`} value={f.reminders} onChange={set('reminders')} /></Field>
        {err && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-red-200">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Save</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
