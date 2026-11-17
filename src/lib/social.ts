export const EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '😮'] as const

export interface ReactionRow { target_type: string; target_id: string; user_id: string; emoji: string }
export type ReactionMap = Map<string, Record<string, string[]>>   // "type:id" -> emoji -> user ids
export const rkey = (type: string, id: string) => `${type}:${id}`

export function groupReactions(rows: ReactionRow[]): ReactionMap {
  const m: ReactionMap = new Map()
  for (const r of rows) {
    const k = rkey(r.target_type, r.target_id)
    const e = m.get(k) ?? {}
    ;(e[r.emoji] ??= []).push(r.user_id)
    m.set(k, e)
  }
  return m
}

export const pollClosed = (p: { closed_at: string | null; closes_at: string | null }, now = Date.now()) =>
  !!p.closed_at || (!!p.closes_at && new Date(p.closes_at).getTime() <= now)

/** Counts per option, distinct voters, and each option's share of voters (multi-choice shares can exceed 100% in total). */
export function pollResults(options: { id: string }[], votes: { option_id: string; user_id: string }[]) {
  const counts: Record<string, number> = Object.fromEntries(options.map((o) => [o.id, 0]))
  const voters = new Set<string>()
  const optionIds = new Set(options.map((o) => o.id))
  for (const v of votes) { if (!optionIds.has(v.option_id)) continue; counts[v.option_id]++; voters.add(v.user_id) }
  const percent = Object.fromEntries(options.map((o) => [o.id, voters.size ? Math.round((counts[o.id] / voters.size) * 100) : 0]))
  return { counts, percent, voters: voters.size }
}

/** Where a feed event should take you. */
export function feedLink(verb: string, entityType: string | null, entityId: string | null): string | null {
  if (verb === 'expense' || verb === 'settlement') return '/expenses'
  if (verb === 'document') return '/wallet'
  if (verb === 'checklist') return '/checklist'
  if (verb === 'announcement') return '/feed/announcements'
  if (verb === 'poll') return '/feed/polls'
  if (entityType === 'activity' && entityId) return `/itinerary/activity/${entityId}`
  return null
}
