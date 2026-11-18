import { useState, type FormEvent } from 'react'
import { Check, ChevronDown, Copy, KeyRound, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react'
import { supabase, unwrap, callAdminUsers } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Avatar, Button, Card, Field, ProgressBar, Spinner, inputCls } from '@/components/ui'
import { groupByCategory, pct } from '@/lib/checklist'
import type { ChecklistItem } from '@/lib/types'

function Credentials({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/60 grid place-items-center p-4">
      <div role="dialog" aria-label="Temporary credentials" className="glass-sheet rounded-3xl p-6 w-full max-w-sm space-y-3">
        <h2 className="font-display text-xl font-semibold text-navy-800">Share these privately</h2>
        <p className="text-navy-600">Shown once and never stored. They can change the password in their Profile.</p>
        <div className="rounded-2xl bg-sand-100 p-4 font-mono text-navy-900 break-all"><p>Username: {username}</p><p>Password: {password}</p></div>
        <div className="flex gap-2">
          <Button variant="soft" onClick={() => void navigator.clipboard.writeText(`Username: ${username}\nPassword: ${password}`).then(() => setCopied(true))}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy'}</Button>
          <Button onClick={onClose} className="flex-1">Done</Button>
        </div>
      </div>
    </div>
  )
}

function Drill({ userId, items }: { userId: string; items: ChecklistItem[] }) {
  const { trip } = useTrip()
  const q = useAsync(async () => new Set((unwrap(await supabase.from('checklist_completions').select('item_id').eq('trip_id', trip!.id).eq('user_id', userId)) as { item_id: string }[]).map((r) => r.item_id)), [userId])
  if (!q.data) return <Spinner />
  return (
    <div className="mt-3 space-y-3">
      {groupByCategory(items).map((g) => (
        <div key={g.category}><p className="text-sm font-semibold text-navy-500">{g.category}</p>
          <ul>{g.items.map((i) => <li key={i.id} className="flex items-center gap-2 min-h-[32px] text-navy-800">{q.data!.has(i.id) ? <Check className="h-4 w-4 text-jungle-600" /> : <X className="h-4 w-4 text-navy-400" />}<span className={q.data!.has(i.id) ? '' : 'text-navy-500'}>{i.title}</span></li>)}</ul></div>
      ))}
    </div>
  )
}

export default function People() {
  const { session } = useAuth()
  const { trip, members, reload } = useTrip()
  const uid = session!.user.id
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const q = useAsync(async () => {
    const [prog, items] = await Promise.all([supabase.rpc('checklist_progress', { t: trip!.id }),
      supabase.from('checklist_items').select('id,category,title,description,due_date,sort_order').eq('trip_id', trip!.id).is('deleted_at', null).order('sort_order')])
    return { prog: (unwrap(prog) ?? []) as { user_id: string; completed: number | string; total: number | string }[], items: unwrap(items) as ChecklistItem[] }
  }, [trip!.id, members.length])

  async function run(key: string, fn: () => Promise<unknown>, after?: (r: any) => void) { // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(key); setErr(null)
    try { const r = await fn(); after?.(r); await reload() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight text-navy-800">People & access</h1><Button onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" />Add traveller</Button></div>
      {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
      <div className="space-y-3">
        {members.map((m) => {
          const p = q.data?.prog.find((x) => x.user_id === m.user_id)
          const v = p ? pct(Number(p.completed), Number(p.total)) : 0
          const me = m.user_id === uid
          return (
            <Card key={m.user_id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar profile={m.profile} size={44} />
                <div className="min-w-0 flex-1"><p className="font-bold text-navy-800 truncate">{m.profile.display_name}{me && <span className="font-normal text-navy-400"> (you)</span>}</p>
                  <p className="text-sm text-navy-500">@{m.profile.username} · {m.role === 'admin' ? <span className="inline-flex items-center gap-1 font-semibold text-navy-700"><ShieldCheck className="h-3.5 w-3.5" />Admin</span> : 'Member'}</p></div>
                <button onClick={() => setOpen(open === m.user_id ? null : m.user_id)} aria-label="Show checklist progress" aria-expanded={open === m.user_id} className="p-2 text-navy-400"><ChevronDown className={`h-5 w-5 transition ${open === m.user_id ? 'rotate-180' : ''}`} /></button>
              </div>
              <div className="mt-3 flex items-center gap-3"><ProgressBar value={v} className="flex-1" /><span className="text-sm font-semibold text-navy-600 w-10 text-right">{v}%</span></div>
              {open === m.user_id && q.data && <Drill userId={m.user_id} items={q.data.items} />}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="soft" busy={busy === 'pw' + m.user_id} onClick={() => confirm(`Reset ${m.profile.display_name}'s password? Their current password stops working.`) && void run('pw' + m.user_id, () => callAdminUsers({ action: 'reset_password', trip_id: trip!.id, user_id: m.user_id }), (r) => setCreds({ username: m.profile.username, password: r.temporary_password }))}><KeyRound className="h-4 w-4" />Reset password</Button>
                {!me && <Button variant="soft" busy={busy === 'role' + m.user_id} onClick={() => void run('role' + m.user_id, () => callAdminUsers({ action: 'set_role', trip_id: trip!.id, user_id: m.user_id, role: m.role === 'admin' ? 'member' : 'admin' }))}>{m.role === 'admin' ? 'Make member' : 'Make admin'}</Button>}
                {!me && <Button variant="ghost" className="text-red-600" onClick={() => confirm(`Remove ${m.profile.display_name} from this trip? They lose access immediately. Their expenses and history stay.`) && void run('rm' + m.user_id, () => callAdminUsers({ action: 'remove_member', trip_id: trip!.id, user_id: m.user_id }))}><Trash2 className="h-4 w-4" />Remove</Button>}
              </div>
            </Card>
          )
        })}
      </div>
      {adding && <AddTraveller onClose={() => setAdding(false)} onCreated={(c) => { setAdding(false); setCreds(c); void reload() }} />}
      {creds && <Credentials {...creds} onClose={() => setCreds(null)} />}
    </div>
  )
}

function AddTraveller({ onClose, onCreated }: { onClose: () => void; onCreated: (c: { username: string; password: string }) => void }) {
  const { trip } = useTrip()
  const [username, setUsername] = useState(''); const [name, setName] = useState(''); const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const u = username.trim().toLowerCase()
    if (!/^[a-z0-9_.]{3,30}$/.test(u)) return setErr('Username: 3–30 characters, lowercase letters, numbers, _ or . only.')
    setBusy(true); setErr(null)
    try { const r = await callAdminUsers({ action: 'create', trip_id: trip!.id, username: u, display_name: name.trim(), role }); onCreated({ username: r.username, password: r.temporary_password }) }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label="Add traveller" onClick={(e) => e.stopPropagation()} className="glass-sheet w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-navy-800">Add traveller</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button></div>
        <Field label="Display name"><input className={inputCls} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="Username" hint="Used to sign in. Cannot be changed later."><input className={inputCls} autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} required /></Field>
        <Field label="Role"><select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select></Field>
        <p className="text-sm text-navy-500">A random password is generated and shown once.</p>
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Create account</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
