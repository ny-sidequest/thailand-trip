import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { useTrip } from './TripContext'
import { useAsync } from '@/hooks/useAsync'
import { useRealtime } from '@/hooks/useRealtime'
import type { AppNotification } from '@/lib/types'

interface State {
  items: AppNotification[]; unread: number; loading: boolean; error?: string
  markRead: (id: string) => Promise<void>; markAllRead: () => Promise<void>; reload: () => void
}
const Ctx = createContext<State | null>(null)
export const useNotifications = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useNotifications outside provider')
  return c
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { trip } = useTrip()
  const uid = session!.user.id
  const tripId = trip!.id
  const q = useAsync(async () => unwrap(await supabase.from('notifications')
    .select('id,type,title,body,link,read_at,created_at').eq('trip_id', tripId).eq('user_id', uid)
    .order('created_at', { ascending: false }).limit(60)) as AppNotification[], [tripId, uid])
  const reload = q.reload
  useRealtime(tripId, ['notifications'], reload)

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid).is('read_at', null)
    reload()
  }, [uid, reload])
  const markAllRead = useCallback(async () => {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('trip_id', tripId).eq('user_id', uid).is('read_at', null)
    reload()
  }, [tripId, uid, reload])

  const items = q.data ?? []
  const value = useMemo(() => ({
    items, unread: items.filter((n) => !n.read_at).length, loading: q.loading, error: q.error, markRead, markAllRead, reload: q.reload,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q.data, q.loading, q.error, markRead, markAllRead])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
