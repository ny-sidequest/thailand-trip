export type Role = 'admin' | 'member'
export type BookingStatus = 'confirmed' | 'pending' | 'suggested' | 'needs_verification' | 'cancelled' | 'completed'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_path: string | null
  phone: string | null
  emergency_contact: string | null
}
export interface Trip {
  id: string
  name: string
  slug: string
  tagline: string | null
  start_date: string
  end_date: string
  timezone: string
  base_currency: 'INR' | 'THB'
  default_thb_to_inr: number
  hero_image_url: string | null
  route_stops: string[]
}
export interface Member { user_id: string; role: Role; profile: Profile }
export interface Day {
  id: string; trip_id: string; day_number: number; day_date: string; city: string; title: string
  summary: string | null; image_url: string | null
}
export interface Activity {
  id: string; trip_id: string; day_id: string; title: string; description: string | null; kind: string
  start_time: string | null; end_time: string | null; time_note: string | null; duration_text: string | null
  location_name: string | null; origin: string | null; destination: string | null; maps_url: string | null
  meeting_point: string | null; pickup_info: string | null; transport_info: string | null
  est_cost_amount: number | null; est_cost_currency: 'THB' | 'INR' | null; reminders: string | null
  status: BookingStatus; booking_ref: string | null; is_optional: boolean; sort_order: number
}
export interface Accommodation {
  id: string; name: string; city: string | null; check_in: string | null; check_out: string | null
  status: BookingStatus; maps_url: string | null
}
export interface Transport {
  id: string; mode: string; operator: string | null; origin: string; destination: string
  travel_date: string | null; time_note: string | null; status: BookingStatus
}
export interface Announcement {
  id: string; title: string; body: string; importance: 'normal' | 'important' | 'urgent'
  pinned: boolean; created_at: string
}
export interface FeedItem {
  id: string; verb: string; summary: string; body: string | null; created_at: string
  actor: Pick<Profile, 'id' | 'display_name' | 'avatar_path'> | null
}
export interface ActivityComment {
  id: string; body: string; created_at: string; updated_at: string; author_id: string
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_path'> | null
}
export interface ActivityBooking {
  id: string; name: string; operator: string | null; booking_ref: string | null; status: BookingStatus
  meeting_point: string | null; pickup_info: string | null; contact: string | null; notes: string | null
}
export interface ChecklistItem {
  id: string; category: string; title: string; description: string | null; due_date: string | null; sort_order: number
}
export interface AppNotification {
  id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string
}
export interface DocumentRow {
  id: string; trip_id: string; name: string; category: string; related_date: string | null
  related_booking_type: 'accommodation' | 'transport' | 'activity' | null; related_booking_id: string | null
  traveller_id: string | null; storage_path: string; mime_type: string | null; size_bytes: number | null
  notes: string | null; version: number; replaces_id: string | null; uploaded_by: string; created_at: string
  deleted_at: string | null; visibility: 'group' | 'private'
}
export interface StayFull {
  id: string; name: string; city: string | null; address: string | null; check_in: string | null; check_out: string | null
  confirmation_ref: string | null; contact: string | null; checkin_instructions: string | null
  maps_url: string | null; notes: string | null; status: BookingStatus
}
export interface TransportFull {
  id: string; mode: string; operator: string | null; origin: string; destination: string; travel_date: string | null
  departure_time: string | null; arrival_time: string | null; time_note: string | null; booking_ref: string | null
  meeting_point: string | null; luggage_notes: string | null; maps_url: string | null; notes: string | null; status: BookingStatus
}
export interface ActivityBookingLite { id: string; name: string; booking_date: string | null }
