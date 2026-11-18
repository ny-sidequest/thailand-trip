import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, CheckSquare, Home, LogOut, MessagesSquare, MoreHorizontal, Receipt, ShieldCheck, UserCircle, Users, Wallet, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Avatar, Spinner, cx } from '@/components/ui'
import NotificationBell from '@/components/NotificationBell'
import OfflineBanner from './OfflineBanner'

const MAIN = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/itinerary', label: 'Plan', icon: CalendarDays },
  { to: '/expenses', label: 'Money', icon: Receipt },
  { to: '/feed', label: 'Feed', icon: MessagesSquare },
]
const MORE = [
  { to: '/guide', label: 'Guide', icon: BookOpen },
  { to: '/checklist', label: 'Checklist', icon: CheckSquare },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/group', label: 'Group', icon: Users },
  { to: '/profile', label: 'My profile', icon: UserCircle },
]
const SIDEBAR_LABELS: Record<string, string> = { '/itinerary': 'Itinerary', '/expenses': 'Expenses', '/wallet': 'Travel Wallet' }

function Logo({ size = 36 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={size} height={size} className="rounded-xl shadow-sm" style={{ width: size, height: size }} />
}

export default function AppShell() {
  const { profile, signOut } = useAuth()
  const { trip, isAdmin } = useTrip()
  const [more, setMore] = useState(false)
  const loc = useLocation()
  const moreItems = isAdmin ? [...MORE, { to: '/admin', label: 'Admin', icon: ShieldCheck }] : MORE
  const sidebar = [MAIN[0], MAIN[1], MORE[0], MORE[1], MORE[2], MAIN[2], MAIN[3], MORE[3], ...(isAdmin ? [moreItems[moreItems.length - 1]] : [])]
  const moreActive = moreItems.some((i) => loc.pathname.startsWith(i.to))

  return (
    <div className="min-h-screen lg:pl-[17.5rem]">
      {/* Ambient light: slow-drifting colour blobs that the glass surfaces refract (decorative) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-jungle-400/30 blur-3xl animate-float" />
        <div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl animate-float [animation-delay:-3s]" />
        <div className="absolute bottom-24 right-1/4 h-72 w-72 rounded-full bg-ember-400/25 blur-3xl animate-float [animation-delay:-6s]" />
      </div>
      {/* Desktop sidebar: floating dark glass */}
      <aside className="hidden lg:flex fixed left-4 top-4 bottom-4 w-64 flex-col glass-dark rounded-[28px] text-white p-5 z-40">
        <div className="flex items-center gap-3 mb-7">
          <Logo size={42} />
          <div className="min-w-0"><p className="font-display text-lg font-medium leading-tight truncate">{trip?.name}</p><p className="eyebrow !text-white/50">Trip HQ</p></div>
        </div>
        <nav className="flex-1 space-y-1" aria-label="Main">
          {sidebar.map(({ to, label, icon: I, ...r }) => (
            <NavLink key={to} to={to} end={'end' in r} className={({ isActive }) =>
              cx('group flex items-center gap-3 rounded-2xl px-3.5 min-h-[46px] font-medium transition duration-200',
                isActive ? 'bg-white/[.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22)] ring-1 ring-white/15' : 'text-white/65 hover:bg-white/[.08] hover:text-white')}>
              <I className="h-[18px] w-[18px]" />{SIDEBAR_LABELS[to] ?? label}
            </NavLink>
          ))}
        </nav>
        <div className="glass-chip-dark rounded-2xl p-2.5 space-y-1.5">
          <NavLink to="/profile" className="flex items-center gap-3 min-w-0 rounded-xl p-1.5 hover:bg-white/10">
            <Avatar profile={profile} size={38} />
            <span className="min-w-0"><span className="block truncate font-semibold text-sm leading-tight">{profile?.display_name}</span><span className="block text-xs text-white/55">@{profile?.username}</span></span>
          </NavLink>
          <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
            <NotificationBell />
            <button onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-xl px-3 min-h-[44px] text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white"><LogOut className="h-[18px] w-[18px]" aria-hidden="true" />Sign out</button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar: floating frosted pill */}
      <header className="lg:hidden sticky top-0 z-30 safe-top px-3 pt-3">
        <div className="glass-nav rounded-2xl h-14 px-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0"><Logo size={32} /><span className="font-display text-lg font-medium tracking-tight text-ink-50 truncate">{trip?.name}</span></div>
          <div className="flex items-center gap-0.5 text-ink-100">
            <NotificationBell className="hover:!bg-white/10" />
            <NavLink to="/profile" aria-label="My profile" className="p-1"><Avatar profile={profile} size={34} /></NavLink>
          </div>
        </div>
      </header>

      <OfflineBanner />
      <main className="mx-auto max-w-5xl px-4 py-5 pb-36 lg:px-8 lg:py-8 lg:pb-10 animate-rise" key={loc.pathname}>
        <Suspense fallback={<Spinner />}><Outlet /></Suspense>
      </main>

      {/* Mobile bottom nav: floating frosted pill */}
      <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 safe-bottom pointer-events-none">
        <ul className="glass-nav rounded-[28px] grid grid-cols-5 gap-1 p-1.5 pointer-events-auto">
          {MAIN.map(({ to, label, icon: I, ...r }) => (
            <li key={to}>
              <NavLink to={to} end={'end' in r} className={({ isActive }) =>
                cx('flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-[20px] text-xs font-semibold transition duration-200',
                  isActive ? 'bg-gradient-to-b from-jungle-500 to-jungle-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(31,157,107,.75)]' : 'text-ink-300 active:bg-white/10')}>
                <I className="h-[22px] w-[22px]" />{label}
              </NavLink>
            </li>
          ))}
          <li>
            <button onClick={() => setMore(true)} aria-haspopup="dialog"
              className={cx('w-full flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-[20px] text-xs font-semibold transition duration-200',
                moreActive ? 'bg-gradient-to-b from-jungle-500 to-jungle-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(31,157,107,.75)]' : 'text-ink-300 active:bg-white/10')}>
              <MoreHorizontal className="h-[22px] w-[22px]" />More
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" onClick={() => setMore(false)}>
          <div role="dialog" aria-label="More" className="glass-sheet absolute bottom-0 inset-x-0 rounded-t-[32px] p-5 safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/25" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-[1.15rem] font-medium tracking-tight text-ink-50">More</h2>
              <button onClick={() => setMore(false)} aria-label="Close" className="p-2 -mr-2 text-ink-300"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {moreItems.map(({ to, label, icon: I }) => (
                <NavLink key={to} to={to} onClick={() => setMore(false)} className="glass-chip flex items-center gap-3 rounded-2xl px-4 min-h-[60px] font-semibold text-ink-50 active:scale-[.98] transition">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-jungle-500/10 text-jungle-300"><I className="h-5 w-5" /></span>{label}
                </NavLink>
              ))}
              <button onClick={() => void signOut()} className="flex items-center gap-3 rounded-2xl px-4 min-h-[60px] font-semibold text-red-300 bg-red-500/10 border border-red-100"><span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10"><LogOut className="h-5 w-5" /></span>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
