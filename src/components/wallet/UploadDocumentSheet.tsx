import { useState, type FormEvent } from 'react'
import { Lock, Upload, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Button, Field, cx, inputCls } from '@/components/ui'
import { ACCEPT, DOC_CATEGORIES, formatBytes, newStoragePath, resolveMime, validateFile } from '@/lib/documents'
import type { ActivityBookingLite, DocumentRow, StayFull, TransportFull } from '@/lib/types'

export interface UploadPreset { category?: string; related_booking_type?: 'accommodation' | 'transport' | 'activity'; related_booking_id?: string; name?: string }

export default function UploadDocumentSheet({ preset, replaces, stays, transport, activityBookings, onClose, onDone }: {
  preset?: UploadPreset; replaces?: DocumentRow; stays: StayFull[]; transport: TransportFull[]
  activityBookings: ActivityBookingLite[]; onClose: () => void; onDone: () => void
}) {
  const { session } = useAuth()
  const { trip, members } = useTrip()
  const uid = session!.user.id
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(replaces?.name ?? preset?.name ?? '')
  const [category, setCategory] = useState(replaces?.category ?? preset?.category ?? 'misc')
  const [date, setDate] = useState(replaces?.related_date ?? '')
  const [booking, setBooking] = useState(replaces?.related_booking_type ? `${replaces.related_booking_type}:${replaces.related_booking_id}` : preset?.related_booking_type ? `${preset.related_booking_type}:${preset.related_booking_id}` : '')
  const [traveller, setTraveller] = useState(replaces?.traveller_id ?? '')
  const [notes, setNotes] = useState('')
  const [priv, setPriv] = useState(replaces ? replaces.visibility === 'private' : false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function pick(f: File | undefined) {
    if (!f) return
    const v = validateFile(f)
    if (v) { setFile(null); return setErr(v) }
    setErr(null); setFile(f)
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').slice(0, 160))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!file) return setErr('Choose a file first.')
    if (!name.trim()) return setErr('Give the document a name.')
    setBusy(true); setErr(null)
    const id = crypto.randomUUID()
    const path = newStoragePath(trip!.id, id, file.name)
    const mime = resolveMime(file)!
    const up = await supabase.storage.from('documents').upload(path, file, { contentType: mime, upsert: false })
    if (up.error) { setBusy(false); return setErr(`Upload failed: ${up.error.message}`) }
    const [bt, bid] = booking ? booking.split(':') : [null, null]
    const { error } = await supabase.from('documents').insert({
      id, trip_id: trip!.id, name: name.trim(), category, related_date: date || null,
      related_booking_type: bt, related_booking_id: bid, traveller_id: traveller || null,
      storage_path: path, mime_type: mime, size_bytes: file.size, notes: notes.trim() || null,
      version: replaces ? replaces.version + 1 : 1, replaces_id: replaces?.id ?? null,
      uploaded_by: uid, visibility: priv ? 'private' : 'group',
    })
    if (error) {
      await supabase.storage.from('documents').remove([path]) // don't leave an orphan file behind
      setBusy(false); return setErr(`Could not save: ${error.message}`)
    }
    setBusy(false); onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label={replaces ? 'Upload new version' : 'Upload document'} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy-800">{replaces ? `New version of “${replaces.name}”` : 'Upload document'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>

        <label className="block rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 p-5 text-center cursor-pointer hover:border-jungle-400">
          <Upload className="mx-auto h-6 w-6 text-navy-300" />
          <span className="mt-1 block font-semibold text-navy-700">{file ? file.name : 'Choose a file or take a photo'}</span>
          <span className="block text-sm text-navy-400">{file ? formatBytes(file.size) : 'PDF, JPG, PNG, WebP, HEIC, Word, Excel · max 20 MB'}</span>
          <input type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
        </label>

        <Field label="Name"><input className={inputCls} value={name} maxLength={160} onChange={(e) => setName(e.target.value)} required /></Field>
        {!replaces && (
          <>
            <Field label="Category">
              <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {DOC_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Related date"><input type="date" className={inputCls} value={date} min={trip!.start_date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="For traveller">
                <select className={inputCls} value={traveller} onChange={(e) => setTraveller(e.target.value)}>
                  <option value="">Everyone</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.display_name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Related booking">
              <select className={inputCls} value={booking} onChange={(e) => setBooking(e.target.value)}>
                <option value="">None</option>
                {stays.length > 0 && <optgroup label="Stays">{stays.map((s) => <option key={s.id} value={`accommodation:${s.id}`}>{s.name}</option>)}</optgroup>}
                {transport.length > 0 && <optgroup label="Transport">{transport.map((t) => <option key={t.id} value={`transport:${t.id}`}>{t.origin} → {t.destination}</option>)}</optgroup>}
                {activityBookings.length > 0 && <optgroup label="Activities">{activityBookings.map((a) => <option key={a.id} value={`activity:${a.id}`}>{a.name}</option>)}</optgroup>}
              </select>
            </Field>
          </>
        )}
        <Field label={replaces ? 'What changed? (optional)' : 'Notes (optional)'}><textarea className={`${inputCls} min-h-[72px] py-3`} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        <fieldset>
          <legend className="text-sm font-semibold text-navy-700 mb-1.5">Who can see this?</legend>
          <div className="grid grid-cols-2 gap-3">
            {[{ v: false, icon: Users, t: 'Whole group', d: 'All travellers' }, { v: true, icon: Lock, t: 'Only me', d: 'Private, even from admin' }].map(({ v, icon: I, t, d }) => (
              <button type="button" key={t} aria-pressed={priv === v} disabled={!!replaces} onClick={() => setPriv(v)}
                className={cx('rounded-2xl border-2 p-3 text-left disabled:opacity-60', priv === v ? 'border-jungle-500 bg-jungle-50' : 'border-sand-200')}>
                <I className="h-5 w-5 text-jungle-600" /><span className="block font-semibold text-navy-800 mt-1">{t}</span><span className="block text-sm text-navy-500">{d}</span>
              </button>
            ))}
          </div>
          {replaces && <p className="text-sm text-navy-400 mt-1">A new version keeps the visibility of the original.</p>}
        </fieldset>

        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">{busy ? 'Uploading…' : 'Upload'}</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
