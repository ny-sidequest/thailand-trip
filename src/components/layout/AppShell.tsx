import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, CheckSquare, Home, LogOut, MessagesSquare, MoreHorizontal, Receipt, ShieldCheck, UserCircle, Users, Wallet, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Avatar, Spinner, cx } from '@/components/ui'
import NotificationBell from '@/components/NotificationBell'
import OfflineBanner from './OfflineBanner'

const MAIN = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/itinerary', label: 'Itinerary', icon: CalendarDays },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/feed', label: 'Feed', icon: MessagesSquare },
]
const MORE = [
  { to: '/checklist', label: 'Checklist', icon: CheckSquare },
  { to: '/wallet', label: 'Travel Wallet', icon: Wallet },
  { to: '/group', label: 'Group', icon: Users },
  { to: '/profile', label: 'My profile', icon: UserCircle },
]

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const { trip, isAdmin } = useTrip()
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const moreItems = isAdmin ? [...MORE, { to: '/admin', label: 'Admin', icon: ShieldCheck }] : MORE
  const sidebar = [MAIN[0], MAIN[1], MORE[0], MORE[1], MAIN[2], MAIN[3], MORE[2], ...(isAdmin ? [moreItems[moreItems.length - 1]] : [])]
  const moreActive = moreItems.some((i) => loc.pathname.startsWith(i.to))

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-navy-800 text-white p-5">
        <div className="mb-8">
          <p className="font-display text-2xl font-bold leading-tight">{trip?.name}</p>
          <p className="text-navy-200 text-sm mt-1">Trip HQ</p>
        </div>
        <nav className="flex-1 space-y-1">
          {sidebar.map(({ to, label, icon: I, ...r }) => (
            <NavLink key={to} to={to} end={'end' in r} className={({ isActive }) =>
              cx('flex items-center gap-3 rounded-xl px-3 min-h-[44px] font-medium transition', isActive ? 'bg-white/15 text-white' : 'text-navy-100 hover:bg-white/10')}>
              <I className="h-5 w-5" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4 flex items-center gap-3">
          <NavLink to="/profile" className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar profile={profile} size={36} />
            <span className="truncate font-medium">{profile?.display_name}</span>
          </NavLink>
          <NotificationBell />
          <button onClick={() => void signOut()} aria-label="Sign out" className="p-2 rounded-lg hover:bg-white/10"><LogOut className="h-5 w-5" /></button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-navy-800 text-white safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="font-display text-lg font-bold">{trip?.name}</span>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <NavLink to="/profile" aria-label="My profile"><Avatar profile={profile} size={32} /></NavLink>
          </div>
        </div>
      </header>

      <OfflineBanner />
      <main className="mx-auto max-w-5xl px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-10 animate-rise" key={loc.pathname}>
        <Suspense fallback={<Spinner />}><Outlet /></Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-sand-200 safe-bottom">
        <ul className="grid grid-cols-5">
          {MAIN.map(({ to, label, icon: I, ...r }) => (
            <li key={to}>
              <NavLink to={to} end={'end' in r} className={({ isActive }) =>
                cx('flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-xs font-semibold', isActive ? 'text-jungle-600' : 'text-navy-400')}>
                <I className="h-6 w-6" />{label}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setMore(true)} className={cx('w-full flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-xs font-semibold', moreActive ? 'text-jungle-600' : 'text-navy-400')}>
              <MoreHorizontal className="h-6 w-6" />More
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="lg:hidden fixed inset-0 z-50 bg-navy-900/50" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="More" className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-white p-5 safe-bottom animate-rise" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-bold text-navy-800">More</h2>
              <button onClick={() => setMore(false)} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {moreItems.map(({ to, label, icon: I }) => (
                <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-2xl bg-sand-100 px-4 min-h-[56px] font-semibold text-navy-800"><I className="h-5 w-5 text-jungle-600" />{label}</NavLink>
              ))}
              <button onClick={() => void signOut()} className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 min-h-[56px] font-semibold text-red-700"><LogOut className="h-5 w-5" />Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
