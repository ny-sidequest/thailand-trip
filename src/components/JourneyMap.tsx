import { MapPin } from 'lucide-react'
import { Avatar, cx } from '@/components/ui'
import CityScene from '@/components/CityScene'
import { fmtDate } from '@/lib/format'
import type { JourneyStop } from '@/lib/journey'
import type { Member } from '@/lib/types'

const ROW = 92        // height of one stop
const W = 76          // width of the road column
const X0 = W / 2
const HW = 900, HH = 72, HM = 56   // horizontal viewBox width / height / side margin

function Car() {
  return (<>
<ellipse cy="2" rx="12" ry="19" fill="#000" opacity=".35" />
              <rect x="-9" y="-16" width="18" height="32" rx="7" fill="#f97316" stroke="#ffd0aa" strokeWidth="1" />
              <rect x="-6.5" y="-8" width="13" height="8" rx="2.5" fill="#0b1428" opacity=".85" />
              <rect x="-6.5" y="5" width="13" height="5" rx="2" fill="#0b1428" opacity=".7" />
              <circle cx="-5" cy="-14.5" r="1.7" fill="#fff3c4" /><circle cx="5" cy="-14.5" r="1.7" fill="#fff3c4" />
              <rect x="-11" y="-11" width="2.5" height="7" rx="1" fill="#0b1428" /><rect x="8.5" y="-11" width="2.5" height="7" rx="1" fill="#0b1428" />
              <rect x="-11" y="5" width="2.5" height="7" rx="1" fill="#0b1428" /><rect x="8.5" y="5" width="2.5" height="7" rx="1" fill="#0b1428" />
  </>)
}

type Phase = 'before' | 'during' | 'after'

/** A quiet road map of the trip: one winding road, a pin per stop, the group's car where they are right now. */
export default function JourneyMap({ journey, current, phase, members, mapsHref }: {
  journey: JourneyStop[]; current: number; phase: Phase; members: Member[]; mapsHref: string | null
}) {
  const n = journey.length
  const xs = journey.map((_, i) => (i === 0 || i === n - 1 ? X0 : i % 2 ? X0 + 15 : X0 - 15))
  const ys = journey.map((_, i) => ROW * i + ROW / 2)
  const H = ROW * n
  let d = `M ${xs[0]} ${ys[0]}`
  for (let i = 1; i < n; i++) d += ` C ${xs[i - 1]} ${ys[i - 1] + ROW * 0.55}, ${xs[i]} ${ys[i] - ROW * 0.55}, ${xs[i]} ${ys[i]}`
  const progress = n > 1 ? current / (n - 1) : 0

  // horizontal geometry (desktop): stops spread across the width, road gently waving
  const hxs = journey.map((_, i) => HM + (n > 1 ? (i * (HW - 2 * HM)) / (n - 1) : 0))
  const hys = journey.map((_, i) => (i === 0 || i === n - 1 ? HH / 2 : i % 2 ? HH / 2 - 14 : HH / 2 + 14))
  let hd = `M ${hxs[0]} ${hys[0]}`
  for (let i = 1; i < n; i++) hd += ` C ${hxs[i - 1] + (hxs[i] - hxs[i - 1]) * 0.55} ${hys[i - 1]}, ${hxs[i] - (hxs[i] - hxs[i - 1]) * 0.55} ${hys[i]}, ${hxs[i]} ${hys[i]}`

  const bannerIdx = phase === 'before' ? Math.min(1, n - 1) : current
  const banner = journey[bannerIdx]
  const bannerTag = phase === 'before' ? 'Next stop' : phase === 'after' ? 'Back home' : 'You are here'

  const sub = (s: JourneyStop): string => {
    if (s.kind === 'start') return phase === 'before' ? 'Where we set off' : 'Where it began'
    if (s.kind === 'end') return 'Home'
    return s.from ? (s.from === s.to ? fmtDate(s.from) : `${fmtDate(s.from)} – ${fmtDate(s.to!)}`) : ''
  }

  return (
    <div>
      {/* Destination art for the next / current stop */}
      <div className="relative h-36 lg:h-44 overflow-hidden">
        {banner && <CityScene city={banner.city} className="absolute inset-0 h-full w-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-night-900/85 via-night-900/15 to-transparent" />
        {banner && (
          <div className="absolute bottom-4 left-5">
            <span className="glass-chip-dark rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[.14em] text-white">{bannerTag}</span>
            <p className="font-display text-2xl font-medium text-white mt-1.5 leading-tight">{banner.city}</p>
            <p className="text-sm text-white/75">{sub(banner)}</p>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="lg:hidden grid grid-cols-[76px_1fr] gap-x-2">
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" className="block">
            {/* road: soft edge, asphalt, lane line */}
            <path d={d} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="30" strokeLinecap="round" />
            <path d={d} fill="none" stroke="#0a1226" strokeWidth="26" strokeLinecap="round" />
            <path d={d} fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="2" strokeDasharray="5 9" strokeLinecap="round" />
            {/* the stretch already driven */}
            {progress > 0 && <path d={d} pathLength={1} fill="none" stroke="#3fb583" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${progress} 1`} style={{ filter: 'drop-shadow(0 0 4px rgba(63,181,131,.8))' }} />}

            {journey.map((s, i) => {
              const done = i < current, here = i === current
              return (
                <g key={i} transform={`translate(${xs[i]} ${ys[i]})`}>
                  {here && <circle r="13" fill="#f97316" opacity=".35" className="animate-ping [transform-box:fill-box] origin-center" />}
                  <circle r={s.kind === 'stop' ? 7 : 9} fill={here ? '#f97316' : done ? '#3fb583' : '#0b1428'} stroke={here ? '#ffd0aa' : done ? '#a2e0bd' : 'rgba(255,255,255,.55)'} strokeWidth="2" />
                  {s.kind !== 'stop' && !here && <circle r="3" fill={done ? '#06231a' : 'rgba(255,255,255,.7)'} />}
                </g>
              )
            })}

            <g transform={`translate(${xs[current]} ${ys[current]}) rotate(180)`}><Car /></g>
          </svg>

          <ol aria-label="Journey stops">
            {journey.map((s, i) => {
              const here = i === current, done = i < current
              return (
                <li key={i} className="flex flex-col justify-center" style={{ height: ROW }} aria-current={here ? 'step' : undefined}>
                  <p className={cx('font-display text-lg leading-tight', here ? 'font-medium text-ink-50' : done ? 'font-normal text-ink-300' : 'font-normal text-ink-100')}>{s.city}</p>
                  {sub(s) && <p className="text-sm text-ink-400 num">{sub(s)}</p>}
                  {here && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex -space-x-2">{members.map((m) => <Avatar key={m.user_id} profile={m.profile} size={24} />)}</div>
                      <span className="text-xs font-semibold text-ember-300">{phase === 'before' ? `All ${members.length} of us in the car` : phase === 'after' ? 'Home safe' : 'The group is here'}</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>

        {/* Desktop: the same journey running left to right */}
        <div className="hidden lg:block pt-2">
          <div className="relative">
            <svg viewBox={`0 0 ${HW} ${HH}`} aria-hidden="true" focusable="false" className="block w-full h-auto">
              <path d={hd} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="30" strokeLinecap="round" />
              <path d={hd} fill="none" stroke="#0a1226" strokeWidth="26" strokeLinecap="round" />
              <path d={hd} fill="none" stroke="rgba(255,255,255,.38)" strokeWidth="2" strokeDasharray="5 9" strokeLinecap="round" />
              {progress > 0 && <path d={hd} pathLength={1} fill="none" stroke="#3fb583" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${progress} 1`} style={{ filter: 'drop-shadow(0 0 4px rgba(63,181,131,.8))' }} />}
              {journey.map((s, i) => {
                const done = i < current, here = i === current
                return (
                  <g key={i} transform={`translate(${hxs[i]} ${hys[i]})`}>
                    {here && <circle r="13" fill="#f97316" opacity=".35" className="animate-ping [transform-box:fill-box] origin-center" />}
                    <circle r={s.kind === 'stop' ? 7 : 9} fill={here ? '#f97316' : done ? '#3fb583' : '#0b1428'} stroke={here ? '#ffd0aa' : done ? '#a2e0bd' : 'rgba(255,255,255,.55)'} strokeWidth="2" />
                    {s.kind !== 'stop' && !here && <circle r="3" fill={done ? '#06231a' : 'rgba(255,255,255,.7)'} />}
                  </g>
                )
              })}
              <g transform={`translate(${hxs[current]} ${hys[current]}) rotate(90)`}><Car /></g>
            </svg>
            <ol aria-label="Journey stops" className="relative h-24">
              {journey.map((s, i) => {
                const here = i === current, done = i < current
                return (
                  <li key={i} className="absolute top-0 -translate-x-1/2 text-center w-40" style={{ left: `${(hxs[i] / HW) * 100}%` }} aria-current={here ? 'step' : undefined}>
                    <p className={cx('font-display text-lg leading-tight', here ? 'font-medium text-ink-50' : done ? 'text-ink-300' : 'text-ink-100')}>{s.city}</p>
                    {sub(s) && <p className="text-sm text-ink-400 num">{sub(s)}</p>}
                    {here && (
                      <div className="mt-1.5 flex flex-col items-center gap-1">
                        <div className="flex -space-x-2">{members.map((m) => <Avatar key={m.user_id} profile={m.profile} size={24} />)}</div>
                        <span className="text-xs font-semibold text-ember-300">{phase === 'before' ? `All ${members.length} of us in the car` : phase === 'after' ? 'Home safe' : 'The group is here'}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
        {mapsHref && (
          <a className="mt-2 inline-flex items-center gap-2 text-jungle-300 font-semibold min-h-[44px]" target="_blank" rel="noopener noreferrer" href={mapsHref}>
            <MapPin className="h-4 w-4" aria-hidden="true" /> Open route in Google Maps
          </a>
        )}
      </div>
    </div>
  )
}
