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
import Checklist from '@/pages/Checklist'
import Notifications from '@/pages/Notifications'
import { NotificationsProvider } from '@/context/NotificationsContext'
import Wallet from '@/pages/Wallet'
import Expenses from '@/pages/Expenses'
import Feed from '@/pages/Feed'
import Admin from '@/pages/Admin'
import Itinerary from '@/pages/Itinerary'
import ActivityDetail from '@/pages/ActivityDetail'
import SetupNotice from '@/pages/SetupNotice'

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
  return <NotificationsProvider><AppShell /></NotificationsProvider>
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
            <Route path="itinerary" element={<Itinerary />} />
            <Route path="itinerary/day/:dayNumber" element={<Itinerary />} />
            <Route path="itinerary/activity/:id" element={<ActivityDetail />} />
            <Route path="checklist" element={<Checklist />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="wallet/*" element={<Wallet />} />
            <Route path="expenses/*" element={<Expenses />} />
            <Route path="feed/*" element={<Feed />} />
            <Route path="group" element={<Group />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin/*" element={<AdminOnly><Admin /></AdminOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </AuthProvider>
  )
}
