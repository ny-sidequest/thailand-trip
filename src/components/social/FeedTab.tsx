import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Camera, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useFeed } from '@/hooks/useSocial'
import { Avatar, Button, Card, EmptyState, ErrorState, Skeleton, cx, inputCls } from '@/components/ui'
import ReactionBar from '@/components/ReactionBar'
import CommentThread from '@/components/CommentThread'
import PrivateImage from '@/components/PrivateImage'
import { compressImage } from '@/lib/images'
import { safeFilename } from '@/lib/documents'
import { feedLink } from '@/lib/social'
import { timeAgo } from '@/lib/format'
import type { FeedPost } from '@/lib/types'

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function Composer({ onPosted }: { onPosted: () => void }) {
  const { session, profile } = useAuth()
  const { trip } = useTrip()
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const busyRef = useRef(false)

  function pick(f: File | undefined) {
    if (!f) return
    const t = f.type || (/\.heic$/i.test(f.name) ? 'image/heic' : '')
    if (!PHOTO_TYPES.includes(t)) return setErr('Choose a photo (JPG, PNG, WebP or HEIC).')
    if (f.size > 25 * 1024 * 1024) return setErr('That photo is too large (max 25 MB).')
    setErr(null); setPhoto(f)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return /heic|heif/.test(t) ? null : URL.createObjectURL(f) })
  }
  function clearPhoto() { setPhoto(null); setPreview((o) => { if (o) URL.revokeObjectURL(o); return null }) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body && !photo) return
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setErr(null)
    let path: string | null = null
    if (photo) {
      const file = await compressImage(photo)
      path = `${trip!.id}/${crypto.randomUUID()}/${safeFilename(file.name)}`
      const up = await supabase.storage.from('photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      if (up.error) { busyRef.current = false; setBusy(false); return setErr(`Upload failed: ${up.error.message}`) }
    }
    const name = profile?.display_name ?? 'Someone'
    const { error } = await supabase.from('activity_feed').insert({
      trip_id: trip!.id, actor_id: session!.user.id, verb: photo ? 'photo' : 'post',
      summary: photo ? `${name} shared a photo` : `${name} posted`, body: body || null, photo_path: path,
    })
    if (error) { if (path) await supabase.storage.from('photos').remove([path]); busyRef.current = false; setBusy(false); return setErr(error.message) }
    setText(''); clearPhoto(); busyRef.current = false; setBusy(false); onPosted()
  }

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="flex gap-3">
        <Avatar profile={profile} size={40} />
        <div className="flex-1 min-w-0 space-y-2">
          <textarea className={`${inputCls} min-h-[72px] py-3`} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share an update with the group…" aria-label="New post" />
          {photo && (
            <div className="relative inline-block">
              {preview ? <img src={preview} alt="Selected" className="max-h-48 rounded-2xl" /> : <p className="rounded-xl bg-sand-100 px-3 py-2 text-navy-600">{photo.name}</p>}
              <button type="button" onClick={clearPhoto} aria-label="Remove photo" className="absolute -top-2 -right-2 grid h-8 w-8 place-items-center rounded-full bg-navy-800 text-white"><X className="h-4 w-4" /></button>
            </div>
          )}
          {err && <p role="alert" className="text-red-700 text-sm">{err}</p>}
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl bg-sand-100 px-4 min-h-[44px] font-semibold text-navy-800 cursor-pointer"><Camera className="h-4 w-4" />Photo<input type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} /></label>
            <Button type="submit" busy={busy} disabled={!text.trim() && !photo} className="ml-auto"><Send className="h-4 w-4" />Post</Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

function PostCard({ post, comments, reload }: { post: FeedPost; comments: number; reload: () => void }) {
  const { session } = useAuth()
  const { isAdmin } = useTrip()
  const [talk, setTalk] = useState(false)
  const social = post.verb === 'post' || post.verb === 'photo'
  const link = feedLink(post.verb, post.entity_type, post.entity_id)
  const canDelete = post.actor_id === session!.user.id || isAdmin

  async function remove() {
    if (!confirm('Delete this post?')) return
    const { error } = await supabase.from('activity_feed').update({ deleted_at: new Date().toISOString() }).eq('id', post.id)
    if (error) alert(error.message); else reload()
  }

  return (
    <Card className={cx('p-4', !social && 'bg-sand-50')}>
      <div className="flex items-start gap-3">
        <Avatar profile={post.actor} size={social ? 40 : 32} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-navy-400"><span className="font-semibold text-navy-800">{post.actor?.display_name ?? 'Someone'}</span> · {timeAgo(post.created_at)}</p>
          {social
            ? post.body && <p className="mt-1 text-navy-800 whitespace-pre-wrap break-words">{post.body}</p>
            : <p className="mt-0.5 text-navy-800">{link ? <Link to={link} className="hover:underline">{post.summary}</Link> : post.summary}{post.body && <span className="block text-navy-500 truncate">{post.body}</span>}</p>}
        </div>
        {canDelete && <button onClick={() => void remove()} aria-label="Delete post" className="p-2 -mr-2 text-navy-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
      </div>
      {post.photo_path && <PrivateImage bucket="photos" path={post.photo_path} alt="Shared photo" className="mt-3 w-full max-h-[70vh] object-cover rounded-2xl" />}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ReactionBar targetType="feed" targetId={post.id} />
        <button onClick={() => setTalk(!talk)} className="ml-auto inline-flex items-center gap-1.5 text-navy-500 font-semibold min-h-[44px] px-2"><MessageCircle className="h-4 w-4" />{comments > 0 ? comments : ''}{talk ? ' Hide' : ' Comment'}</button>
      </div>
      {talk && <div className="mt-3 border-t border-sand-200 pt-4"><CommentThread targetType="feed" targetId={post.id} /></div>}
    </Card>
  )
}

export default function FeedTab({ tripId }: { tripId: string }) {
  const [limit, setLimit] = useState(25)
  const q = useFeed(tripId, limit)
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  return (
    <div className="space-y-4">
      <Composer onPosted={q.reload} />
      {!q.data ? <><Skeleton className="h-28" /><Skeleton className="h-28" /></>
        : q.data.posts.length === 0 ? <Card><EmptyState title="Nothing here yet" hint="Post the first update or photo!" /></Card>
        : <>
            {q.data.posts.map((p) => <PostCard key={p.id} post={p} comments={q.data!.counts[p.id] ?? 0} reload={q.reload} />)}
            {q.data.posts.length >= limit && <Button variant="soft" className="w-full" onClick={() => setLimit(limit + 25)}>Load older</Button>}
          </>}
    </div>
  )
}
