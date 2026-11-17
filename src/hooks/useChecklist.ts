import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { ChecklistItem } from '@/lib/types'

export interface Progress { user_id: string; completed: number; total: number }

export function useChecklist(tripId: string) {
  const { session } = useAuth()
  const uid = session!.user.id
  const q = useAsync(async () => {
    const [items, mine, prog] = await Promise.all([
      supabase.from('checklist_items').select('id,category,title,description,due_date,sort_order').eq('trip_id', tripId).is('deleted_at', null).order('sort_order'),
      // explicit user filter: admins can read everyone's rows, but this screen is "my" checklist
      supabase.from('checklist_completions').select('item_id').eq('trip_id', tripId).eq('user_id', uid),
      supabase.rpc('checklist_progress', { t: tripId }),
    ])
    return {
      items: unwrap(items) as ChecklistItem[],
      done: new Set((unwrap(mine) as { item_id: string }[]).map((r) => r.item_id)),
      progress: ((unwrap(prog) ?? []) as { user_id: string; completed: number | string; total: number | string }[])
        .map((p): Progress => ({ user_id: p.user_id, completed: Number(p.completed), total: Number(p.total) })),
    }
  }, [tripId, uid])
  useRealtime(tripId, ['checklist_items', 'checklist_pings'], q.reload)
  return q
}
