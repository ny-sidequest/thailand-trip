import { useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bed, Bus, Clock, MapPin, MessageCircle, Navigation, Plane, Ship, WifiOff } from 'lucide-react'
import { useTrip } from '@/context/TripContext'
import { useItinerary } from '@/hooks/useItinerary'
import { Card, EmptyState, ErrorState, Skeleton, StatusBadge, cx } from '@/components/ui'
import { KindIcon } from '@/components/KindIcon'
import { daysUntil, fmtDate, fmtDateLong, fmtTime } from '@/lib/format'
import { dayRouteUrl } from '@/lib/maps'
import type { Day } from '@/lib/types'

const MODE_ICON: Record<string, typeof Bus> = { flight: Plane, bus: Bus, ferry: Ship, speedboat: Ship }

function defaultDay(days: Day[]): number {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return days.find((d) => d.day_date === iso)?.day_number ?? days[0]?.day_number ?? 1
}

export default function Itinerary() {
  const { trip } = useTrip()
  const { dayNumber } = useParams()
  const q = useItinerary(trip!.id)
  const stripRef = useRef<HTMLDivElement>(null)

  const days = q.data?.days ?? []
  const selected = days.find((d) => d.day_number === Number(dayNumber)) ?? days.find((d) => d.day_number === defaultDay(days))

  useEffect(() => {
    stripRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [selected?.id])

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
  if (days.length === 0 || !selected) return <EmptyState title="No itinerary yet" hint="The trip admin hasn't added any days." />

  const acts = q.data.acts.filter((a) => a.day_id === selected.id).sort((a, b) => a.sort_order - b.sort_order)
  const stays = q.data.acc.filter((a) => a.check_in && a.check_out && a.check_in <= selected.day_date && selected.day_date <= a.check_out)
  const moves = q.data.tr.filter((t) => t.travel_date === selected.day_date)
  const route = dayRouteUrl(acts, selected.city)
  const idx = days.indexOf(selected)
  const until = daysUntil(selected.day_date)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold text-navy-800">Itinerary</h1>
      {q.data.savedAt && <p role="status" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-amber-900 inline-flex items-center gap-2"><WifiOff className="h-4 w-4" />Offline copy saved {new Date(q.data.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}

      {/* Day strip */}
      <div ref={stripRef} className="-mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto pb-2 snap-x" role="tablist" aria-label="Days">
        {days.map((d) => {
          const on = d.id === selected.id
          return (
            <Link key={d.id} to={`/itinerary/day/${d.day_number}`} role="tab" aria-selected={on} aria-current={on ? 'true' : undefined}
              className={cx('snap-center shrink-0 w-[84px] rounded-2xl px-2 py-2.5 text-center border transition',
                on ? 'bg-navy-800 text-white border-navy-800' : 'bg-white text-navy-700 border-sand-200 hover:border-jungle-400')}>
              <span className={cx('block text-xs font-semibold uppercase tracking-wide', on ? 'text-sand-300' : 'text-navy-400')}>Day {d.day_number}</span>
              <span className="block text-lg font-bold leading-tight">{fmtDate(d.day_date, { day: 'numeric', month: 'short' })}</span>
              <span className="block text-sm truncate">{d.city}</span>
            </Link>
          )
        })}
      </div>

      {/* Day header */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-ember-600">Day {selected.day_number} · {fmtDateLong(selected.day_date)}{until > 0 ? ` · in ${until} day${until === 1 ? '' : 's'}` : until === 0 ? ' · today' : ''}</p>
        <h2 className="font-display text-2xl font-bold text-navy-800 mt-1">{selected.title}</h2>
        {selected.summary && <p className="text-navy-600 mt-1">{selected.summary}</p>}
        {route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-jungle-600 text-white px-4 min-h-[44px] font-semibold hover:bg-jungle-700">
            <Navigation className="h-4 w-4" />Open day route in Maps
          </a>
        )}
      </Card>

      {/* Bookings on this date */}
      {(stays.length > 0 || moves.length > 0) && (
        <Card className="divide-y divide-sand-200/70">
          {stays.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-100"><Bed className="h-5 w-5 text-navy-700" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy-800 truncate">{s.name}</p>
                <p className="text-sm text-navy-500">{s.check_in === selected.day_date ? 'Check-in' : s.check_out === selected.day_date ? 'Check-out' : 'Staying'}{s.city ? ` · ${s.city}` : ''}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
          {moves.map((t) => {
            const I = MODE_ICON[t.mode] ?? Bus
            return (
              <div key={t.id} className="flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-100"><I className="h-5 w-5 text-navy-700" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-800 truncate">{t.origin} → {t.destination}</p>
                  <p className="text-sm text-navy-500">{[t.operator, t.time_note].filter(Boolean).join(' · ') || t.mode}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            )
          })}
        </Card>
      )}

      {/* Timeline */}
      {acts.length === 0 ? <Card><EmptyState title="Nothing planned for this day" /></Card> : (
        <ol className="space-y-3">
          {acts.map((a) => {
            const t = fmtTime(a.start_time)
            const n = q.data!.counts[a.id] ?? 0
            return (
              <li key={a.id}>
                <Link to={`/itinerary/activity/${a.id}`} className={cx('block rounded-3xl bg-white border shadow-card p-4 hover:border-jungle-400 transition', a.is_optional ? 'border-dashed border-sand-300' : 'border-sand-200/60')}>
                  <div className="flex gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-jungle-50 text-jungle-700"><KindIcon kind={a.kind} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-navy-800 leading-snug">{a.title}</h3>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-1 text-navy-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4 text-navy-300" />{t ?? a.time_note ?? 'Time to be confirmed'}{t && a.time_note ? ` · ${a.time_note}` : ''}</span>
                        {a.location_name && <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="h-4 w-4 text-navy-300 shrink-0" /><span className="truncate">{a.location_name}</span></span>}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-sm text-navy-400">
                        {a.is_optional && <span className="font-semibold text-ember-600">Optional</span>}
                        {n > 0 && <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" />{n}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}

      {/* Prev / next */}
      <div className="flex justify-between gap-3">
        {idx > 0 ? <Link className="rounded-xl bg-white border border-sand-200 px-4 min-h-[44px] inline-flex items-center font-semibold text-navy-700" to={`/itinerary/day/${days[idx - 1].day_number}`}>← Day {days[idx - 1].day_number}</Link> : <span />}
        {idx < days.length - 1 && <Link className="rounded-xl bg-white border border-sand-200 px-4 min-h-[44px] inline-flex items-center font-semibold text-navy-700" to={`/itinerary/day/${days[idx + 1].day_number}`}>Day {days[idx + 1].day_number} →</Link>}
      </div>
    </div>
  )
}
