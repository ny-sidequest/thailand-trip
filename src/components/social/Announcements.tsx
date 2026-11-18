import { useState, type FormEvent } from 'react'
import { Check, Pin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Button, Card, EmptyState, Field, cx, inputCls } from '@/components/ui'
import ReactionBar from '@/components/ReactionBar'
import CommentThread from '@/components/CommentThread'
import EditRecordSheet from '@/components/EditRecordSheet'
import { timeAgo } from '@/lib/format'
import type { AnnouncementFull } from '@/lib/types'

type Data = { items: AnnouncementFull[]; mine: Set<string>; readers: { announcement_id: string; user_id: string }[] }

export function AnnouncementCard({ a, data, reload, compact }: { a: AnnouncementFull; data: Data; reload: () => void; compact?: boolean }) {
  const { session } = useAuth()
  const { trip, members, isAdmin } = useTrip()
  const uid = session!.user.id
  const [edit, setEdit] = useState(false)
  const [talk, setTalk] = useState(false)
  const read = data.mine.has(a.id)
  const tone = a.importance === 'urgent' ? 'border-red-300 bg-red-50' : a.importance === 'important' ? 'border-ember-300 bg-ember-50' : ''
  const readBy = new Set(data.readers.filter((r) => r.announcement_id === a.id).map((r) => r.user_id))

  async function markRead() {
    const { error } = await supabase.from('announcement_reads').insert({ announcement_id: a.id, user_id: uid, trip_id: trip!.id })
    if (error && error.code !== '23505') alert(error.message)
    reload()
  }
  async function patch(p: Record<string, unknown>) { const { error } = await supabase.from('announcements').update(p).eq('id', a.id); if (error) alert(error.message); reload() }

  return (
    <Card className={cx('p-5', tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {!read && <span className="h-2.5 w-2.5 rounded-full bg-ember-500 shrink-0" aria-label="Unread" />}
            {a.pinned && <Pin className="h-4 w-4 text-navy-500" aria-label="Pinned" />}
            {a.importance !== 'normal' && <span className={cx('rounded-full px-2 py-0.5 text-sm font-bold uppercase', a.importance === 'urgent' ? 'bg-red-600 text-white' : 'bg-ember-500 text-white')}>{a.importance}</span>}
            <h3 className="font-bold text-navy-800">{a.title}</h3>
          </div>
          <p className="text-navy-700 mt-1 whitespace-pre-wrap break-words">{a.body}</p>
        </div>
        <span className="text-sm text-navy-400 shrink-0">{timeAgo(a.created_at)}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!read && <Button variant="soft" onClick={() => void markRead()}><Check className="h-4 w-4" />Mark as read</Button>}
        {!compact && <button onClick={() => setTalk(!talk)} className="text-jungle-700 font-semibold min-h-[44px] px-2">{talk ? 'Hide comments' : 'Comments'}</button>}
        {isAdmin && !compact && (
          <span className="ml-auto flex gap-1">
            <button onClick={() => void patch({ pinned: !a.pinned })} aria-label={a.pinned ? 'Unpin' : 'Pin'} className="p-2 text-navy-400 hover:text-navy-800"><Pin className="h-4 w-4" /></button>
            <button onClick={() => setEdit(true)} aria-label="Edit" className="p-2 text-navy-400 hover:text-navy-800"><Pencil className="h-4 w-4" /></button>
            <button onClick={() => confirm('Delete this announcement?') && void patch({ deleted_at: new Date().toISOString() })} aria-label="Delete" className="p-2 text-navy-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </span>
        )}
      </div>
      {isAdmin && !compact && (
        <p className="mt-1 text-sm text-navy-500">Read by {readBy.size} of {members.length}{readBy.size < members.length ? ` · waiting on ${members.filter((m) => !readBy.has(m.user_id)).map((m) => m.profile.display_name).join(', ')}` : ''}</p>
      )}
      {!compact && <div className="mt-2"><ReactionBar targetType="announcement" targetId={a.id} /></div>}
      {talk && <div className="mt-4 border-t border-sand-200 pt-4"><CommentThread targetType="announcement" targetId={a.id} /></div>}
      {edit && <EditRecordSheet title="Edit announcement" table="announcements" id={a.id} initial={a as unknown as Record<string, unknown>} onClose={() => setEdit(false)} onSaved={reload}
        fields={[{ key: 'title', label: 'Title', type: 'text', required: true, max: 160 }, { key: 'body', label: 'Message', type: 'textarea', required: true, max: 3000 },
          { key: 'importance', label: 'Importance', type: 'select', required: true, options: [{ value: 'normal', label: 'Normal' }, { value: 'important', label: 'Important' }, { value: 'urgent', label: 'Urgent' }] }]} />}
    </Card>
  )
}

export function ComposeAnnouncement({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { session } = useAuth()
  const { trip } = useTrip()
  const [title, setTitle] = useState(''); const [body, setBody] = useState('')
  const [importance, setImportance] = useState('normal'); const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return setErr('Add a title and a message.')
    setBusy(true); setErr(null)
    const { error } = await supabase.from('announcements').insert({ trip_id: trip!.id, title: title.trim(), body: body.trim(), importance, pinned, created_by: session!.user.id })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label="New announcement" onClick={(e) => e.stopPropagation()} className="glass-sheet w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold text-navy-800">New announcement</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button></div>
        <Field label="Title"><input className={inputCls} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Message"><textarea className={`${inputCls} min-h-[110px] py-3`} maxLength={3000} value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
        <Field label="Importance"><select className={inputCls} value={importance} onChange={(e) => setImportance(e.target.value)}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></Field>
        <label className="flex items-center gap-3 min-h-[44px]"><input type="checkbox" className="h-5 w-5" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /><span className="font-semibold text-navy-700">Pin to the top</span></label>
        <p className="text-sm text-navy-500">Everyone is notified when you post.</p>
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Post</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}

export default function AnnouncementsTab({ data, reload }: { data: Data; reload: () => void }) {
  const { session } = useAuth()
  const { trip, isAdmin } = useTrip()
  const [compose, setCompose] = useState(false)
  const unread = data.items.filter((a) => !data.mine.has(a.id))
  async function markAll() {
    const rows = unread.map((a) => ({ announcement_id: a.id, user_id: session!.user.id, trip_id: trip!.id }))
    const { error } = await supabase.from('announcement_reads').upsert(rows, { onConflict: 'announcement_id,user_id', ignoreDuplicates: true })
    if (error) alert(error.message)
    reload()
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {isAdmin && <Button onClick={() => setCompose(true)}><Plus className="h-4 w-4" />New announcement</Button>}
        {unread.length > 1 && <Button variant="soft" onClick={() => void markAll()}><Check className="h-4 w-4" />Mark all read ({unread.length})</Button>}
      </div>
      {data.items.length === 0 ? <Card><EmptyState title="No announcements" hint="Important updates from the trip admin appear here." /></Card>
        : data.items.map((a) => <AnnouncementCard key={a.id} a={a} data={data} reload={reload} />)}
      {compose && <ComposeAnnouncement onClose={() => setCompose(false)} onDone={reload} />}
    </div>
  )
}
