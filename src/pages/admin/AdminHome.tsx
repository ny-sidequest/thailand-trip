import { Link } from 'react-router-dom'
import { AlertTriangle, BedDouble, CalendarDays, CheckSquare, FileText, Megaphone, Receipt, Settings, Users } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Card, SectionTitle, StatusBadge } from '@/components/ui'
import type { BookingStatus } from '@/lib/types'

const TILES = [
  { to: '/admin/trip', icon: Settings, title: 'Trip settings', desc: 'Name, dates, exchange rate, route, hero photo' },
  { to: '/admin/people', icon: Users, title: 'People & access', desc: 'Add travellers, reset passwords, roles, progress' },
  { to: '/admin/itinerary', icon: CalendarDays, title: 'Itinerary', desc: 'Days, activities, order, timings, map links' },
  { to: '/admin/bookings', icon: BedDouble, title: 'Bookings', desc: 'Stays, transport and activity bookings' },
  { to: '/admin/checklist', icon: CheckSquare, title: 'Checklist', desc: 'Shared items and deadlines' },
  { to: '/feed/announcements', icon: Megaphone, title: 'Announcements & polls', desc: 'Post updates, create polls' },
  { to: '/wallet', icon: FileText, title: 'Documents', desc: 'Upload, replace and manage files' },
  { to: '/expenses', icon: Receipt, title: 'Expenses', desc: 'Group totals, corrections, audit trail' },
]

export default function AdminHome() {
  const { trip, members } = useTrip()
  const q = useAsync(async () => {
    const [acts, days, stays, tr] = await Promise.all([
      supabase.from('itinerary_activities').select('id,title,status,day_id').eq('trip_id', trip!.id).is('deleted_at', null).in('status', ['needs_verification', 'pending']),
      supabase.from('itinerary_days').select('id,day_number').eq('trip_id', trip!.id).is('deleted_at', null),
      supabase.from('accommodation_bookings').select('id,name,status').eq('trip_id', trip!.id).is('deleted_at', null).in('status', ['needs_verification', 'pending']),
      supabase.from('transport_bookings').select('id,origin,destination,status').eq('trip_id', trip!.id).is('deleted_at', null).in('status', ['needs_verification', 'pending']),
    ])
    const dn = new Map((unwrap(days) as { id: string; day_number: number }[]).map((d) => [d.id, d.day_number]))
    return {
      acts: (unwrap(acts) as { id: string; title: string; status: BookingStatus; day_id: string }[]).map((a) => ({ ...a, day: dn.get(a.day_id) })),
      stays: unwrap(stays) as { id: string; name: string; status: BookingStatus }[],
      tr: unwrap(tr) as { id: string; origin: string; destination: string; status: BookingStatus }[],
    }
  }, [trip!.id])
  const d = q.data

  return (
    <div className="space-y-6">
      <div><h1 className="font-display text-3xl font-bold text-navy-800">Admin</h1><p className="text-navy-500">{trip!.name} · {members.length} travellers. Changes are shared with everyone instantly.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TILES.map(({ to, icon: I, title, desc }) => (
          <Link key={to} to={to} className="flex items-start gap-3 rounded-3xl bg-white border border-sand-200/60 shadow-card p-4 hover:border-jungle-400 transition">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-jungle-50 text-jungle-700"><I className="h-5 w-5" /></span>
            <span><span className="block font-bold text-navy-800">{title}</span><span className="block text-navy-500 text-sm">{desc}</span></span>
          </Link>
        ))}
      </div>
      <section>
        <SectionTitle><span className="inline-flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-ember-500" />Needs attention</span></SectionTitle>
        <Card className="divide-y divide-sand-200/70">
          {!d ? <p className="p-4 text-navy-400">Loading…</p> : d.acts.length + d.stays.length + d.tr.length === 0 ? <p className="p-4 text-navy-500">Nothing pending. Every booking is confirmed or completed.</p> : (
            <>
              {d.tr.map((t) => <Link key={t.id} to="/admin/bookings/transport" className="flex items-center justify-between gap-3 p-4 hover:bg-sand-50"><span className="font-semibold text-navy-800">{t.origin} → {t.destination}</span><StatusBadge status={t.status} /></Link>)}
              {d.stays.map((s) => <Link key={s.id} to="/admin/bookings" className="flex items-center justify-between gap-3 p-4 hover:bg-sand-50"><span className="font-semibold text-navy-800">{s.name}</span><StatusBadge status={s.status} /></Link>)}
              {d.acts.map((a) => <Link key={a.id} to={`/itinerary/activity/${a.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-sand-50"><span className="min-w-0"><span className="block font-semibold text-navy-800 truncate">{a.title}</span>{a.day && <span className="text-sm text-navy-400">Day {a.day}</span>}</span><StatusBadge status={a.status} /></Link>)}
            </>
          )}
        </Card>
      </section>
    </div>
  )
}
