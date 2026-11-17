import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { TripProvider, useTrip } from '@/context/TripContext'
import { isConfigured } from '@/lib/supabase'
import AppShell from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
import Group from '@/pages/Group'
import Profile from '@/pages/Profile'
import ComingSoon from '@/pages/ComingSoon'
import SetupNotice from '@/pages/SetupNotice'
import { CalendarDays, CheckSquare, Wallet, Receipt, MessagesSquare, ShieldCheck } from 'lucide-react'

function Protected() {
  const { session, loading } = useAuth()
  const { loading: tl, trip, error } = useTrip()
  if (loading || (session && tl)) return <div className="min-h-screen grid place-items-center"><Spinner /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!trip) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-bold text-navy-800">No trip yet</h1>
        <p className="mt-2 text-navy-600">{error ?? 'Your account is not part of a trip. Ask the trip admin to add you.'}</p>
      </div>
    </div>
  )
  return <AppShell />
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { isAdmin } = useTrip()
  return isAdmin ? children : <Navigate to="/" replace />
}

export default function App() {
  if (!isConfigured) return <SetupNotice />
  return (
    <AuthProvider>
      <TripProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Home />} />
            <Route path="itinerary/*" element={<ComingSoon title="Itinerary" phase={2} icon={<CalendarDays className="h-8 w-8" />} />} />
            <Route path="checklist" element={<ComingSoon title="Checklist" phase={3} icon={<CheckSquare className="h-8 w-8" />} />} />
            <Route path="wallet/*" element={<ComingSoon title="Travel Wallet" phase={4} icon={<Wallet className="h-8 w-8" />} />} />
            <Route path="expenses/*" element={<ComingSoon title="Expenses" phase={5} icon={<Receipt className="h-8 w-8" />} />} />
            <Route path="feed" element={<ComingSoon title="Social Feed" phase={6} icon={<MessagesSquare className="h-8 w-8" />} />} />
            <Route path="group" element={<Group />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/*" element={<AdminOnly><ComingSoon title="Admin" phase={7} icon={<ShieldCheck className="h-8 w-8" />} /></AdminOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </AuthProvider>
  )
}
