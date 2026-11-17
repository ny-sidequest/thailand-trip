import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { useRealtime } from '@/hooks/useRealtime'
import type { Member, Profile, Role, Trip } from '@/lib/types'

interface TripState {
  trips: Trip[]
  trip: Trip | null
  members: Member[]
  myRole: Role | null
  isAdmin: boolean
  loading: boolean
  error: string | null
  selectTrip: (id: string) => void
  reload: () => Promise<void>
  memberName: (id: string | null | undefined) => string
}
const Ctx = createContext<TripState | null>(null)
export const useTrip = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTrip outside TripProvider')
  return c
}
const PREF_KEY = 'tripHQ.currentTrip' // harmless UI preference only

export function TripProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const uid = session?.user.id
  const [trips, setTrips] = useState<Trip[]>([])
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [currentId, setCurrentId] = useState<string | null>(localStorage.getItem(PREF_KEY))
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!uid) { setTrips([]); setMembers([]); setLoading(false); return }
    const mine = await supabase.from('trip_members').select('role, trips(*)').eq('user_id', uid)
    if (mine.error) { setError(mine.error.message); setLoading(false); return }
    const rows = (mine.data ?? []) as unknown as { role: Role; trips: Trip | null }[]
    const list = rows.map((r) => r.trips).filter((t): t is Trip => !!t)
    setTrips(list)
    setRoles(Object.fromEntries(rows.filter((r) => r.trips).map((r) => [r.trips!.id, r.role])))
    const id = list.find((t) => t.id === currentId)?.id ?? list[0]?.id ?? null
    setCurrentId(id)
    if (id) {
      const m = await supabase.from('trip_members')
        .select('user_id, role, profiles(id,username,display_name,avatar_path,phone,emergency_contact)')
        .eq('trip_id', id)
      if (m.error) setError(m.error.message)
      else {
        setError(null)
        const ms = ((m.data ?? []) as unknown as { user_id: string; role: Role; profiles: Profile }[])
          .map((r) => ({ user_id: r.user_id, role: r.role, profile: r.profiles }))
          .sort((a, b) => a.profile.display_name.localeCompare(b.profile.display_name))
        setMembers(ms)
      }
    }
    setLoading(false)
  }, [uid, currentId])

  useEffect(() => { setLoading(true); void load() }, [load])
  useRealtime(currentId ?? undefined, ['trip_members'], () => void load())

  const trip = trips.find((t) => t.id === currentId) ?? null
  const selectTrip = useCallback((id: string) => { localStorage.setItem(PREF_KEY, id); setCurrentId(id) }, [])
  const myRole = trip ? roles[trip.id] ?? null : null
  const memberName = useCallback((id: string | null | undefined) =>
    members.find((m) => m.user_id === id)?.profile.display_name ?? 'Someone', [members])

  const value = useMemo(() => ({
    trips, trip, members, myRole, isAdmin: myRole === 'admin', loading, error, selectTrip, reload: load, memberName,
  }), [trips, trip, members, myRole, loading, error, selectTrip, load, memberName])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
