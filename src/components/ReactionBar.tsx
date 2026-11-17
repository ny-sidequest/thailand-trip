import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useReactions } from '@/hooks/useReactions'
import { cx } from '@/components/ui'
import { EMOJIS, rkey } from '@/lib/social'

/** Emoji reactions for any target. Own reactions toggle; counts are live. */
export default function ReactionBar({ targetType, targetId }: { targetType: 'feed' | 'activity' | 'announcement' | 'comment' | 'poll'; targetId: string }) {
  const { session } = useAuth()
  const { trip } = useTrip()
  const uid = session!.user.id
  const q = useReactions(trip!.id)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const mine = q.data?.get(rkey(targetType, targetId)) ?? {}

  async function toggle(emoji: string) {
    if (busy) return
    setBusy(true)
    const has = mine[emoji]?.includes(uid)
    if (has) await supabase.from('reactions').delete().eq('target_type', targetType).eq('target_id', targetId).eq('user_id', uid).eq('emoji', emoji)
    else await supabase.from('reactions').insert({ trip_id: trip!.id, target_type: targetType, target_id: targetId, user_id: uid, emoji })
    setBusy(false); setPicker(false); q.reload()
  }

  const used = EMOJIS.filter((e) => mine[e]?.length)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {used.map((e) => (
        <button key={e} onClick={() => void toggle(e)} aria-pressed={mine[e].includes(uid)} aria-label={`${e} ${mine[e].length}`}
          className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 min-h-[36px] text-sm font-semibold', mine[e].includes(uid) ? 'border-jungle-500 bg-jungle-50 text-jungle-800' : 'border-sand-200 bg-white text-navy-700')}>
          <span>{e}</span><span>{mine[e].length}</span>
        </button>
      ))}
      {picker
        ? EMOJIS.map((e) => <button key={e} onClick={() => void toggle(e)} className="rounded-full min-h-[40px] min-w-[40px] text-xl hover:bg-sand-100">{e}</button>)
        : <button onClick={() => setPicker(true)} aria-label="Add reaction" className="inline-grid place-items-center rounded-full min-h-[36px] min-w-[36px] text-navy-400 hover:bg-sand-100"><SmilePlus className="h-5 w-5" /></button>}
    </div>
  )
}
