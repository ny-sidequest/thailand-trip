import { supabase, unwrap } from '@/lib/supabase'
import { groupReactions, type ReactionRow } from '@/lib/social'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'

export function useReactions(tripId: string) {
  const q = useAsync(async () => groupReactions(unwrap(await supabase.from('reactions').select('target_type,target_id,user_id,emoji').eq('trip_id', tripId)) as ReactionRow[]), [tripId])
  useRealtime(tripId, ['reactions'], q.reload)
  return q
}
