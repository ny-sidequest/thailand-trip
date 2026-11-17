import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from './useAsync'
import { useRealtime } from './useRealtime'
import type { AnnouncementFull, FeedPost, PollOption, PollRow, PollVote } from '@/lib/types'

export function useFeed(tripId: string, limit: number) {
  const q = useAsync(async () => {
    const [feed, cm] = await Promise.all([
      supabase.from('activity_feed').select('id,verb,summary,body,photo_path,entity_type,entity_id,actor_id,created_at,actor:profiles!actor_id(id,display_name,avatar_path)')
        .eq('trip_id', tripId).is('deleted_at', null).order('created_at', { ascending: false }).limit(limit),
      supabase.from('comments').select('target_id').eq('trip_id', tripId).eq('target_type', 'feed').is('deleted_at', null),
    ])
    const counts: Record<string, number> = {}
    for (const c of unwrap(cm) as { target_id: string }[]) counts[c.target_id] = (counts[c.target_id] ?? 0) + 1
    return { posts: unwrap(feed) as unknown as FeedPost[], counts }
  }, [tripId, limit])
  useRealtime(tripId, ['activity_feed', 'comments'], q.reload)
  return q
}

export function useAnnouncements(tripId: string) {
  const { session } = useAuth()
  const uid = session!.user.id
  const q = useAsync(async () => {
    const [an, rd] = await Promise.all([
      supabase.from('announcements').select('id,title,body,importance,pinned,created_at,created_by').eq('trip_id', tripId).is('deleted_at', null)
        .order('pinned', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('announcement_reads').select('announcement_id,user_id').eq('trip_id', tripId),   // members get their own rows; admin gets all
    ])
    const reads = unwrap(rd) as { announcement_id: string; user_id: string }[]
    return {
      items: unwrap(an) as AnnouncementFull[],
      mine: new Set(reads.filter((r) => r.user_id === uid).map((r) => r.announcement_id)),
      readers: reads,   // used for admin "read by" only
    }
  }, [tripId, uid])
  useRealtime(tripId, ['announcements', 'announcement_reads'], q.reload)
  return q
}

export function usePolls(tripId: string) {
  const q = useAsync(async () => {
    const [p, o, v] = await Promise.all([
      supabase.from('polls').select('id,question,multiple_choice,closes_at,closed_at,created_by,created_at').eq('trip_id', tripId).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('poll_options').select('id,poll_id,label,sort_order').eq('trip_id', tripId).order('sort_order'),
      supabase.from('poll_votes').select('poll_id,option_id,user_id').eq('trip_id', tripId),
    ])
    return { polls: unwrap(p) as PollRow[], options: unwrap(o) as PollOption[], votes: unwrap(v) as PollVote[] }
  }, [tripId])
  useRealtime(tripId, ['polls', 'poll_options', 'poll_votes'], q.reload)
  return q
}
