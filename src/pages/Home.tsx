import { Link } from 'react-router-dom'
import { Bed, Bell, Bus, CalendarClock, CheckSquare, FileText, BookOpen, Map as MapIcon, MapPin, Plane, Ship } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { useAnnouncements } from '@/hooks/useSocial'
import { AnnouncementCard } from '@/components/social/Announcements'
import { useRealtime } from '@/hooks/useRealtime'
import { useNow } from '@/hooks/useNow'
import CityScene from '@/components/CityScene'
import JourneyMap from '@/components/JourneyMap'
import { buildJourney, currentStopIndex, isoToday } from '@/lib/journey'
import { Avatar, Card, EmptyState, ErrorState, ProgressBar, SectionTitle, Skeleton, StatusBadge } from '@/components/ui'
import { cityRuns, tripClock, fmtDate, fmtDateLong, fmtTime, mapsDirectionsUrl, safeUrl, timeAgo } from '@/lib/format'
import type { Accommodation, Activity, Day, FeedItem, Transport } from '@/lib/types'

interface Progress { user_id: string; completed: number; total: number }

const MODE_ICON: Record<string, typeof Bus> = { flight: Plane, bus: Bus, ferry: Ship, speedboat: Ship }

export default function Home() {
  const { profile } = useAuth()
  const { trip, members } = useTrip()
  const tripId = trip!.id

  const q = useAsync(async () => {
    const [days, acts, acc, tr, feed, prog] = await Promise.all([
      supabase.from('itinerary_days').select('*').eq('trip_id', tripId).is('deleted_at', null).order('day_number'),
      supabase.from('itinerary_activities').select('*').eq('trip_id', tripId).is('deleted_at', null).order('sort_order'),
      supabase.from('accommodation_bookings').select('id,name,city,check_in,check_out,status,maps_url').eq('trip_id', tripId).is('deleted_at', null).order('check_in'),
      supabase.from('transport_bookings').select('id,mode,operator,origin,destination,travel_date,time_note,status').eq('trip_id', tripId).is('deleted_at', null).order('travel_date'),
      supabase.from('activity_feed').select('id,verb,summary,body,created_at,actor:profiles!actor_id(id,display_name,avatar_path)').eq('trip_id', tripId).is('deleted_at', null).order('created_at', { ascending: false }).limit(6),
      supabase.rpc('checklist_progress', { t: tripId }),
    ])
    return {
      days: unwrap(days) as Day[], acts: unwrap(acts) as Activity[], acc: unwrap(acc) as Accommodation[],
      tr: unwrap(tr) as Transport[], feed: unwrap(feed) as unknown as FeedItem[],
      prog: (unwrap(prog) ?? []) as Progress[],
    }
  }, [tripId])

  useRealtime(tripId, ['itinerary_activities', 'itinerary_days', 'accommodation_bookings', 'transport_bookings', 'activity_feed', 'checklist_pings', 'checklist_items'], q.reload)

  const clock = tripClock(trip!.start_date, trip!.end_date, useNow())

  return (
    <div className="space-y-8">
      {/* Hero: aurora glass over destination art, live countdown */}
      <section className="relative overflow-hidden rounded-[32px] glass-dark text-white min-h-[22rem]"
        style={safeUrl(trip!.hero_image_url) ? { backgroundImage: `linear-gradient(rgba(11,31,58,.55),rgba(11,31,58,.8)), url(${safeUrl(trip!.hero_image_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!trip!.hero_image_url && <CityScene city={trip!.route_stops[1] ?? trip!.route_stops[0] ?? 'Bangkok'} className="absolute inset-0 h-full w-full opacity-90" />}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-900/80 via-navy-900/35 to-navy-900/10" />
        <div className="absolute -top-20 -right-12 h-64 w-64 rounded-full bg-ember-500/40 blur-3xl animate-float" />
        <div className="relative p-6 sm:p-8 flex flex-col min-h-[22rem]">
          <p className="eyebrow !text-sand-200">{fmtDate(trip!.start_date, { day: 'numeric', month: 'short' })} – {fmtDate(trip!.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          <h1 className="font-display text-[2.1rem] sm:text-5xl font-medium tracking-[-0.03em] mt-2 leading-[1.06]">{trip!.name}</h1>
          {trip!.tagline && <p className="text-white/80 mt-2 max-w-xl text-lg">{trip!.tagline}</p>}

          <div className="mt-auto pt-8 flex flex-wrap items-end justify-between gap-4">
            {clock.state === 'before' ? (
              <div className="grid grid-cols-3 gap-2 w-full max-w-[19rem]" role="timer" aria-label={`${clock.days} days, ${clock.hours} hours, ${clock.minutes} minutes until departure`}>
                {([['days', clock.days], ['hrs', clock.hours], ['min', clock.minutes]] as const).map(([l, v]) => (
                  <div key={l} className="glass-chip-dark rounded-2xl py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.25)]">
                    <p className="font-display text-3xl sm:text-4xl font-light leading-none num">{String(v).padStart(2, '0')}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[.14em] text-white/70">{l}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-chip-dark rounded-2xl px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]">
                <p className="font-display text-3xl font-medium leading-none">{clock.state === 'during' ? `Day ${clock.day} of ${clock.total}` : 'Trip complete'}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[.14em] text-white/70">{clock.state === 'during' ? 'Enjoy it' : 'See you next time'}</p>
              </div>
            )}
            <div className="glass-chip-dark rounded-full pl-1.5 pr-4 py-1.5 flex items-center gap-3">
              <div className="flex -space-x-2">{members.map((m) => <Avatar key={m.user_id} profile={m.profile} size={32} />)}</div>
              <span className="text-sm font-semibold text-white/90">Hi, {profile?.display_name.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      </section>

      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.loading && !q.data && <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}

      {q.data && <Dashboard d={q.data} />}
    </div>
  )
}

function Dashboard({ d }: { d: { days: Day[]; acts: Activity[]; acc: Accommodation[]; tr: Transport[]; feed: FeedItem[]; prog: Progress[] } }) {
  const { session } = useAuth()
  const { trip, members } = useTrip()
  const ann = useAnnouncements(trip!.id)
  const runs = cityRuns(d.days)
  const stops = trip!.route_stops.length ? trip!.route_stops : runs.map((r) => r.city)
  const journey = buildJourney(stops, runs)
  const todayIso = isoToday()
  const currentIdx = currentStopIndex(journey, trip!.start_date, trip!.end_date, todayIso)
  const phase = todayIso < trip!.start_date ? 'before' : todayIso > trip!.end_date ? 'after' : 'during'
  const dayById = new Map(d.days.map((x) => [x.id, x]))

  // next activity
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const nowT = today.toTimeString().slice(0, 5)
  const upcoming = d.acts
    .map((a) => ({ a, day: dayById.get(a.day_id)! }))
    .filter(({ a, day }) => day && !['cancelled', 'completed'].includes(a.status) && (day.day_date > iso || (day.day_date === iso && (!a.start_time || a.start_time.slice(0, 5) >= nowT))))
    .sort((x, y) => x.day.day_date.localeCompare(y.day.day_date) || x.a.sort_order - y.a.sort_order)
  const next = upcoming.find(({ a }) => !a.is_optional && a.kind !== 'option') ?? upcoming[0]

  // bookings
  type B = { key: string; icon: typeof Bus; title: string; sub: string; date: string; status: Accommodation['status'] }
  const bookings: B[] = [
    ...d.acc.map((x): B => ({ key: 'a' + x.id, icon: Bed, title: x.name, sub: x.city ?? '', date: x.check_in ?? '', status: x.status })),
    ...d.tr.map((x): B => ({ key: 't' + x.id, icon: MODE_ICON[x.mode] ?? Bus, title: `${x.origin} → ${x.destination}`, sub: x.operator ?? x.mode, date: x.travel_date ?? '', status: x.status })),
  ].filter((b) => b.date >= iso && !['cancelled', 'completed'].includes(b.status)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  // checklist progress
  const mine = d.prog.find((p) => p.user_id === session?.user.id)
  const myPct = mine && mine.total ? (Number(mine.completed) / Number(mine.total)) * 100 : 0
  const totalPossible = d.prog.reduce((s, p) => s + Number(p.total), 0)
  const groupPct = totalPossible ? (d.prog.reduce((s, p) => s + Number(p.completed), 0) / totalPossible) * 100 : 0

  return (
    <>
      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0">
        {[
          { to: '/wallet', icon: FileText, label: 'Tickets & docs' },
          { to: '/itinerary', icon: MapIcon, label: 'Itinerary' },
          { to: '/checklist', icon: CheckSquare, label: 'My checklist' },
          { to: '/guide', icon: BookOpen, label: 'Destination guide' },
        ].map(({ to, icon: I, label }) => (
          <Link key={to} to={to} className="glass hover-lift flex items-center gap-3 rounded-2xl px-3.5 min-h-[64px] font-semibold text-ink-50 active:scale-[.98] transition">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-jungle-400/30 to-jungle-600/15 text-jungle-300 ring-1 ring-inset ring-jungle-500/20"><I className="h-5 w-5" aria-hidden="true" /></span>{label}
          </Link>
        ))}
      </div>

      {/* Route: a quiet road map, the group's car where they are right now */}
      <section>
        <SectionTitle>The journey</SectionTitle>
        <Card className="overflow-hidden">
          <JourneyMap journey={journey} current={currentIdx} phase={phase} members={members}
            mapsHref={mapsDirectionsUrl([...new Set(runs.map((r) => r.city))].map((c) => `${c}, Thailand`)) } />
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Next up */}
        <section>
          <SectionTitle>Up next</SectionTitle>
          <Card className="p-5">
            {next ? (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-ember-300"><CalendarClock className="h-4 w-4" />Day {next.day.day_number} · {fmtDateLong(next.day.day_date)}</div>
                <Link to={`/itinerary/activity/${next.a.id}`}><h3 className="font-display text-2xl font-medium text-ink-50 mt-1 hover:underline">{next.a.title}</h3></Link>
                <p className="text-ink-200 mt-1">{[fmtTime(next.a.start_time) ?? next.a.time_note, next.a.location_name].filter(Boolean).join(' · ')}</p>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <StatusBadge status={next.a.status} />
                  {safeUrl(next.a.maps_url) && <a className="text-jungle-300 font-semibold inline-flex items-center gap-1 min-h-[44px]" href={safeUrl(next.a.maps_url)!} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" />Directions</a>}
                </div>
              </>
            ) : <EmptyState title="Nothing scheduled" hint="The admin can add activities in the itinerary." />}
          </Card>
        </section>

        {/* Checklist */}
        <section>
          <SectionTitle action={<Link to="/checklist" className="text-jungle-300 font-semibold min-h-[44px] inline-flex items-center">Open</Link>}>Preparation</SectionTitle>
          <Card className="p-5 space-y-4">
            {totalPossible === 0 ? <EmptyState title="No checklist items yet" /> : (
              <>
                <div><div className="flex justify-between font-semibold text-ink-50 mb-1.5"><span>You</span><span>{Math.round(myPct)}%</span></div><ProgressBar value={myPct} /></div>
                <div><div className="flex justify-between font-semibold text-ink-50 mb-1.5"><span>Whole group</span><span>{Math.round(groupPct)}%</span></div><ProgressBar value={groupPct} /></div>
              </>
            )}
          </Card>
        </section>
      </div>

      {/* Announcements */}
      <section>
        <SectionTitle action={<Link to="/feed/announcements" className="text-jungle-300 font-semibold min-h-[44px] inline-flex items-center">All</Link>}><span className="inline-flex items-center gap-2"><Bell className="h-5 w-5 text-ember-500" />Announcements</span></SectionTitle>
        {!ann.data ? <Skeleton className="h-24" /> : ann.data.items.length === 0 ? <Card><EmptyState title="No announcements" hint="Important updates from the admin appear here." /></Card> : (
          <div className="space-y-3">{ann.data.items.slice(0, 3).map((a) => <AnnouncementCard key={a.id} a={a} data={ann.data!} reload={ann.reload} compact />)}</div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Bookings */}
        <section>
          <SectionTitle>Upcoming bookings</SectionTitle>
          <Card className="divide-y divide-white/10">
            {bookings.length === 0 ? <EmptyState title="No upcoming bookings" /> : bookings.map((b) => (
              <div key={b.key} className="flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.07] text-ink-100"><b.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="font-semibold text-ink-50 truncate">{b.title}</p><p className="text-sm text-ink-300">{fmtDate(b.date)}{b.sub ? ` · ${b.sub}` : ''}</p></div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </Card>
        </section>

        {/* Feed */}
        <section>
          <SectionTitle action={<Link to="/feed" className="text-jungle-300 font-semibold min-h-[44px] inline-flex items-center">All</Link>}>Recent activity</SectionTitle>
          <Card className="divide-y divide-white/10">
            {d.feed.length === 0 ? <EmptyState title="Quiet for now" hint="Uploads, expenses and posts show up here live." /> : d.feed.map((f) => (
              <div key={f.id} className="flex items-start gap-3 p-4">
                <Avatar profile={f.actor} size={36} />
                <div className="min-w-0 flex-1"><p className="text-ink-50">{f.summary}</p>{f.body && <p className="text-ink-300 truncate">{f.body}</p>}</div>
                <span className="text-sm text-ink-400 shrink-0">{timeAgo(f.created_at)}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  )
}
