import { useState, type FormEvent } from 'react'
import { MessageCircle, Pencil, Send, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { useRealtime } from '@/hooks/useRealtime'
import { Avatar, Button, EmptyState, ErrorState, Spinner, inputCls } from '@/components/ui'
import { timeAgo } from '@/lib/format'
import type { ActivityComment } from '@/lib/types'

export default function CommentThread({ targetType, targetId }: { targetType: 'activity' | 'feed' | 'announcement' | 'poll'; targetId: string }) {
  const { session, profile } = useAuth()
  const { trip, isAdmin } = useTrip()
  const tripId = trip!.id
  const uid = session!.user.id
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const q = useAsync(async () => unwrap(await supabase.from('comments')
    .select('id,body,created_at,updated_at,author_id,author:profiles!author_id(id,display_name,avatar_path)')
    .eq('trip_id', tripId).eq('target_type', targetType).eq('target_id', targetId)
    .is('deleted_at', null).order('created_at')) as unknown as ActivityComment[], [tripId, targetType, targetId])
  useRealtime(tripId, ['comments'], q.reload)

  async function post(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true); setErr(null)
    const { error } = await supabase.from('comments').insert({ trip_id: tripId, target_type: targetType, target_id: targetId, author_id: uid, body })
    setBusy(false)
    if (error) return setErr(error.message)
    setText(''); q.reload()
  }
  async function saveEdit(id: string) {
    const body = editText.trim()
    if (!body) return
    const { error } = await supabase.from('comments').update({ body }).eq('id', id)
    if (error) return setErr(error.message)
    setEditing(null); q.reload()
  }
  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return setErr(error.message)
    q.reload()
  }

  return (
    <section aria-label="Comments">
      <h2 className="font-display text-xl font-semibold text-navy-800 mb-3 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-jungle-600" />Comments{q.data ? ` (${q.data.length})` : ''}</h2>
      {q.loading && !q.data && <Spinner />}
      {q.error && <ErrorState message={q.error} onRetry={q.reload} />}
      {q.data && q.data.length === 0 && <EmptyState title="No comments yet" hint="Start the conversation about this plan." />}
      <ul className="space-y-4">
        {q.data?.map((c) => {
          const mine = c.author_id === uid
          return (
            <li key={c.id} className="flex gap-3">
              <Avatar profile={c.author} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-navy-400"><span className="font-semibold text-navy-800">{c.author?.display_name ?? 'Someone'}</span> · {timeAgo(c.created_at)}{new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() > 2000 && ' · edited'}</p>
                {editing === c.id ? (
                  <div className="mt-1 space-y-2">
                    <textarea className={`${inputCls} min-h-[80px] py-3`} maxLength={2000} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <div className="flex gap-2"><Button onClick={() => void saveEdit(c.id)}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                  </div>
                ) : (
                  <p className="text-navy-800 whitespace-pre-wrap break-words">{c.body}</p>
                )}
                {editing !== c.id && (mine || isAdmin) && (
                  <div className="flex gap-1 -ml-2">
                    {mine && <button onClick={() => { setEditing(c.id); setEditText(c.body) }} className="inline-flex items-center gap-1 px-2 min-h-[40px] text-sm text-navy-500"><Pencil className="h-3.5 w-3.5" />Edit</button>}
                    <button onClick={() => void remove(c.id)} className="inline-flex items-center gap-1 px-2 min-h-[40px] text-sm text-red-600"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <form onSubmit={post} className="mt-5 flex gap-3 items-start">
        <Avatar profile={profile} size={36} />
        <div className="flex-1 space-y-2">
          <textarea className={`${inputCls} min-h-[72px] py-3`} placeholder="Add a comment…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Add a comment" />
          {err && <p role="alert" className="text-red-700 text-sm">{err}</p>}
          <Button type="submit" busy={busy} disabled={!text.trim()}><Send className="h-4 w-4" />Post</Button>
        </div>
      </form>
    </section>
  )
}
