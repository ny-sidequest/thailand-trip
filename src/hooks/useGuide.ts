import { supabase, unwrap } from '@/lib/supabase'
import { readCache, writeCache } from '@/lib/offlineCache'
import { useAuth } from '@/context/AuthContext'
import type { GuideItem } from '@/lib/guide'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'

/** Guide content for the trip. Shared reference material (no private data), so a read-only offline copy is kept. */
export function useGuide(tripId: string) {
  const { session } = useAuth()
  const uid = session!.user.id
  const q = useAsync(async () => {
    try {
      const rows = unwrap(await supabase.from('guide_items').select('*').eq('trip_id', tripId).is('deleted_at', null).order('sort_order')) as GuideItem[]
      writeCache(uid, tripId, 'guide', rows)
      return { items: rows, savedAt: null as number | null }
    } catch (e) {
      const hit = readCache<GuideItem[]>(uid, tripId, 'guide')
      if (hit) return { items: hit.data, savedAt: hit.savedAt as number | null }
      throw e
    }
  }, [tripId, uid])
  useRealtime(tripId, ['guide_items'], q.reload)
  return q
}
