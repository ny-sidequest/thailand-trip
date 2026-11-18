import { lazy, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { TripProvider, useTrip } from '@/context/TripContext'
import { isConfigured } from '@/lib/supabase'
import AppShell from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui'
import Login from '@/pages/Login'
import Home from '@/pages/Home'
const Group = lazy(() => import('@/pages/Group'))
const Profile = lazy(() => import('@/pages/Profile'))
const Checklist = lazy(() => import('@/pages/Checklist'))
const Notifications = lazy(() => import('@/pages/Notifications'))
import { NotificationsProvider } from '@/context/NotificationsContext'
const Wallet = lazy(() => import('@/pages/Wallet'))
const Expenses = lazy(() => import('@/pages/Expenses'))
const Feed = lazy(() => import('@/pages/Feed'))
const Guide = lazy(() => import('@/pages/Guide'))
const Admin = lazy(() => import('@/pages/Admin'))
const Itinerary = lazy(() => import('@/pages/Itinerary'))
const ActivityDetail = lazy(() => import('@/pages/ActivityDetail'))
import SetupNotice from '@/pages/SetupNotice'

function Protected() {
  const { session, loading } = useAuth()
  const { loading: tl, trip, error } = useTrip()
  if (loading || (session && tl)) return <div className="min-h-screen grid place-items-center"><Spinner /></div>
  if (!session) return <Navigate to="/login" replace />
  if (!trip) return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-medium text-ink-50">No trip yet</h1>
        <p className="mt-2 text-ink-200">{error ?? 'Your account is not part of a trip. Ask the trip admin to add you.'}</p>
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
            <Route path="guide" element={<Guide />} />
            <Route path="guide/:itemId" element={<Guide />} />
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
