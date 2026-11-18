import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AdminHome from './admin/AdminHome'
import TripSettings from './admin/TripSettings'
import People from './admin/People'
import ItineraryAdmin from './admin/ItineraryAdmin'
import BookingsAdmin from './admin/BookingsAdmin'
import ChecklistAdmin from './admin/ChecklistAdmin'
import GuideAdmin from './admin/GuideAdmin'

/** UI only: every operation here is also enforced by RLS / admin-only functions in the database. */
export default function Admin() {
  const { pathname } = useLocation()
  const atRoot = /\/admin\/?$/.test(pathname)
  return (
    <div className="space-y-4">
      {!atRoot && <Link to="/admin" className="inline-flex items-center gap-1 text-jungle-300 font-semibold min-h-[44px]"><ArrowLeft className="h-4 w-4" />Admin</Link>}
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="trip" element={<TripSettings />} />
        <Route path="people" element={<People />} />
        <Route path="itinerary" element={<ItineraryAdmin />} />
        <Route path="itinerary/:dayId" element={<ItineraryAdmin />} />
        <Route path="bookings" element={<BookingsAdmin />} />
        <Route path="bookings/:kind" element={<BookingsAdmin />} />
        <Route path="checklist" element={<ChecklistAdmin />} />
        <Route path="guide" element={<GuideAdmin />} />
      </Routes>
    </div>
  )
}
