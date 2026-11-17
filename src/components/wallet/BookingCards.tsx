import { useState } from 'react'
import { Bed, Bus, FileText, Hash, KeyRound, Luggage, MapPin, Pencil, Phone, Plane, Plus, Ship, Users } from 'lucide-react'
import { useTrip } from '@/context/TripContext'
import { Button, Card, EmptyState, StatusBadge } from '@/components/ui'
import EditRecordSheet, { type FieldSpec } from '@/components/EditRecordSheet'
import { fmtDate, fmtTime, mapsSearchUrl, safeUrl, STATUS_LABEL } from '@/lib/format'
import type { BookingStatus, DocumentRow, StayFull, TransportFull } from '@/lib/types'
import type { UploadPreset } from './UploadDocumentSheet'

const statusOptions = (Object.keys(STATUS_LABEL) as BookingStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))
const isPhone = (s: string) => /^[+\d][\d\s()-]{6,}$/.test(s.trim())

function Line({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return <div className="flex gap-3 py-2"><span className="mt-0.5 text-navy-300 shrink-0">{icon}</span><div className="min-w-0"><p className="text-sm font-semibold text-navy-400">{label}</p><div className="text-navy-800 break-words whitespace-pre-wrap">{children}</div></div></div>
}
function Docs({ docs, onOpen, onAdd }: { docs: DocumentRow[]; onOpen: (d: DocumentRow) => void; onAdd: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {docs.map((d) => <button key={d.id} onClick={() => onOpen(d)} className="inline-flex items-center gap-1.5 rounded-xl bg-sand-100 px-3 min-h-[40px] text-sm font-semibold text-navy-800 max-w-full"><FileText className="h-4 w-4 shrink-0 text-jungle-600" /><span className="truncate">{d.name}</span></button>)}
      <button onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-sand-300 px-3 min-h-[40px] text-sm font-semibold text-navy-600"><Plus className="h-4 w-4" />Add document</button>
    </div>
  )
}

const STAY_FIELDS: FieldSpec[] = [
  { key: 'status', label: 'Booking status', type: 'select', required: true, options: statusOptions, hint: 'Only mark Confirmed when it is actually booked.' },
  { key: 'name', label: 'Property name', type: 'text', required: true, max: 160 },
  { key: 'city', label: 'City', type: 'text' }, { key: 'address', label: 'Address', type: 'textarea', max: 500 },
  { key: 'check_in', label: 'Check-in date', type: 'date' }, { key: 'check_out', label: 'Check-out date', type: 'date' },
  { key: 'confirmation_ref', label: 'Booking confirmation', type: 'text', max: 80 },
  { key: 'contact', label: 'Contact details', type: 'text' },
  { key: 'checkin_instructions', label: 'Check-in instructions', type: 'textarea' },
  { key: 'maps_url', label: 'Google Maps link', type: 'url', hint: 'Optional. Otherwise a search link is built from the address.' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]
const TRANSPORT_FIELDS: FieldSpec[] = [
  { key: 'status', label: 'Booking status', type: 'select', required: true, options: statusOptions, hint: 'Only mark Confirmed when it is actually booked.' },
  { key: 'mode', label: 'Mode', type: 'select', required: true, options: ['flight', 'bus', 'ferry', 'speedboat', 'taxi', 'train', 'other'].map((m) => ({ value: m, label: m[0].toUpperCase() + m.slice(1) })) },
  { key: 'operator', label: 'Operator', type: 'text' },
  { key: 'origin', label: 'From', type: 'text', required: true }, { key: 'destination', label: 'To', type: 'text', required: true },
  { key: 'travel_date', label: 'Date', type: 'date' },
  { key: 'departure_time', label: 'Departure', type: 'time' }, { key: 'arrival_time', label: 'Arrival', type: 'time' },
  { key: 'time_note', label: 'Time note', type: 'text', hint: 'e.g. “approx 17:00, unconfirmed”' },
  { key: 'booking_ref', label: 'Booking reference', type: 'text', max: 80 },
  { key: 'meeting_point', label: 'Meeting point', type: 'text' }, { key: 'luggage_notes', label: 'Luggage restrictions', type: 'textarea' },
  { key: 'maps_url', label: 'Google Maps link', type: 'url' }, { key: 'notes', label: 'Notes', type: 'textarea' },
]

export function StayList({ stays, docs, onOpen, onAdd, reload }: { stays: StayFull[]; docs: DocumentRow[]; onOpen: (d: DocumentRow) => void; onAdd: (p: UploadPreset) => void; reload: () => void }) {
  const { isAdmin } = useTrip()
  const [edit, setEdit] = useState<StayFull | null>(null)
  if (stays.length === 0) return <Card><EmptyState title="No accommodation yet" hint="The trip admin adds stays." /></Card>
  return (
    <div className="space-y-4">
      {stays.map((s) => {
        const nights = s.check_in && s.check_out ? Math.round((Date.parse(s.check_out) - Date.parse(s.check_in)) / 86_400_000) : null
        const map = safeUrl(s.maps_url) ?? (s.address || s.name ? mapsSearchUrl([s.name, s.address ?? s.city].filter(Boolean).join(', ')) : null)
        const mine = docs.filter((d) => d.related_booking_type === 'accommodation' && d.related_booking_id === s.id)
        return (
          <Card key={s.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-jungle-50 text-jungle-700"><Bed className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="font-bold text-navy-800 text-lg leading-snug">{s.name}</h3>
                <p className="text-navy-500">{s.city}{s.check_in ? `${s.city ? ' · ' : ''}${fmtDate(s.check_in)}${s.check_out ? ` → ${fmtDate(s.check_out)}` : ''}${nights ? ` (${nights} night${nights === 1 ? '' : 's'})` : ''}` : ''}</p></div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-2 divide-y divide-sand-200/60">
              {s.address && <Line icon={<MapPin className="h-5 w-5" />} label="Address">{s.address}</Line>}
              {s.confirmation_ref && <Line icon={<Hash className="h-5 w-5" />} label="Confirmation">{s.confirmation_ref}</Line>}
              {s.contact && <Line icon={<Phone className="h-5 w-5" />} label="Contact">{isPhone(s.contact) ? <a className="text-jungle-700 font-semibold" href={`tel:${s.contact.replace(/[^+\d]/g, '')}`}>{s.contact}</a> : s.contact}</Line>}
              {s.checkin_instructions && <Line icon={<KeyRound className="h-5 w-5" />} label="Check-in instructions">{s.checkin_instructions}</Line>}
              {s.notes && <Line icon={<Users className="h-5 w-5" />} label="Notes">{s.notes}</Line>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {map && <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-jungle-600 text-white px-4 min-h-[44px] font-semibold hover:bg-jungle-700"><MapPin className="h-4 w-4" />Open in Maps</a>}
              {isAdmin && <Button variant="soft" onClick={() => setEdit(s)}><Pencil className="h-4 w-4" />Edit</Button>}
            </div>
            <Docs docs={mine} onOpen={onOpen} onAdd={() => onAdd({ category: /hostel/i.test(s.name) ? 'hostel' : 'hotel', related_booking_type: 'accommodation', related_booking_id: s.id, name: `${s.name} confirmation` })} />
          </Card>
        )
      })}
      {edit && <EditRecordSheet title="Edit accommodation" subtitle={edit.name} table="accommodation_bookings" id={edit.id} fields={STAY_FIELDS} initial={edit as unknown as Record<string, unknown>} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  )
}

const MODE_ICON: Record<string, typeof Bus> = { flight: Plane, bus: Bus, ferry: Ship, speedboat: Ship }
export function TransportList({ items, docs, onOpen, onAdd, reload }: { items: TransportFull[]; docs: DocumentRow[]; onOpen: (d: DocumentRow) => void; onAdd: (p: UploadPreset) => void; reload: () => void }) {
  const { isAdmin } = useTrip()
  const [edit, setEdit] = useState<TransportFull | null>(null)
  if (items.length === 0) return <Card><EmptyState title="No transport yet" hint="The trip admin adds flights, buses and ferries." /></Card>
  return (
    <div className="space-y-4">
      {items.map((t) => {
        const I = MODE_ICON[t.mode] ?? Bus
        const times = [fmtTime(t.departure_time) && `Departs ${fmtTime(t.departure_time)}`, fmtTime(t.arrival_time) && `Arrives ${fmtTime(t.arrival_time)}`, t.time_note].filter(Boolean).join(' · ')
        const map = safeUrl(t.maps_url) ?? (t.meeting_point ? mapsSearchUrl(t.meeting_point) : null)
        const mine = docs.filter((d) => d.related_booking_type === 'transport' && d.related_booking_id === t.id)
        return (
          <Card key={t.id} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-jungle-50 text-jungle-700"><I className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><h3 className="font-bold text-navy-800 text-lg leading-snug">{t.origin} → {t.destination}</h3>
                <p className="text-navy-500">{[t.travel_date && fmtDate(t.travel_date, { weekday: 'short', day: 'numeric', month: 'short' }), t.operator ?? t.mode].filter(Boolean).join(' · ')}</p></div>
              <StatusBadge status={t.status} />
            </div>
            <div className="mt-2 divide-y divide-sand-200/60">
              {times && <Line icon={<Bus className="h-5 w-5" />} label="Times">{times}</Line>}
              {t.booking_ref && <Line icon={<Hash className="h-5 w-5" />} label="Booking reference">{t.booking_ref}</Line>}
              {t.meeting_point && <Line icon={<MapPin className="h-5 w-5" />} label="Meeting point">{t.meeting_point}</Line>}
              {t.luggage_notes && <Line icon={<Luggage className="h-5 w-5" />} label="Luggage">{t.luggage_notes}</Line>}
              {t.notes && <Line icon={<Users className="h-5 w-5" />} label="Notes">{t.notes}</Line>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {map && <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-jungle-600 text-white px-4 min-h-[44px] font-semibold hover:bg-jungle-700"><MapPin className="h-4 w-4" />Meeting point</a>}
              {isAdmin && <Button variant="soft" onClick={() => setEdit(t)}><Pencil className="h-4 w-4" />Edit</Button>}
            </div>
            <Docs docs={mine} onOpen={onOpen} onAdd={() => onAdd({ category: ({ flight: 'flight', bus: 'bus', ferry: 'ferry', speedboat: 'ferry' } as Record<string, string>)[t.mode] ?? 'misc', related_booking_type: 'transport', related_booking_id: t.id, name: `${t.origin} to ${t.destination} ticket` })} />
          </Card>
        )
      })}
      {edit && <EditRecordSheet title="Edit transport" subtitle={`${edit.origin} → ${edit.destination}`} table="transport_bookings" id={edit.id} fields={TRANSPORT_FIELDS} initial={edit as unknown as Record<string, unknown>} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  )
}
