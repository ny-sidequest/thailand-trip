import { useState, type FormEvent } from 'react'
import { Lock, Plus, Trash2, Trophy, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Avatar, Button, Card, EmptyState, Field, cx, inputCls } from '@/components/ui'
import ReactionBar from '@/components/ReactionBar'
import { pollClosed, pollResults } from '@/lib/social'
import { fmtDate, timeAgo } from '@/lib/format'
import type { PollOption, PollRow, PollVote } from '@/lib/types'

function PollCard({ poll, options, votes, reload }: { poll: PollRow; options: PollOption[]; votes: PollVote[]; reload: () => void }) {
  const { session } = useAuth()
  const { members, isAdmin, memberName } = useTrip()
  const uid = session!.user.id
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const closed = pollClosed(poll)
  const r = pollResults(options, votes)
  const mine = new Set(votes.filter((v) => v.user_id === uid).map((v) => v.option_id))
  const top = Math.max(0, ...Object.values(r.counts))

  async function cast(optionId: string) {
    if (closed || busy) return
    const next = new Set(mine)
    if (next.has(optionId)) next.delete(optionId)
    else { if (!poll.multiple_choice) next.clear(); next.add(optionId) }
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('set_poll_votes', { p_poll: poll.id, p_options: [...next] })
    setBusy(false)
    if (error) setErr(error.message)
    reload()
  }
  async function patch(p: Record<string, unknown>) { const { error } = await supabase.from('polls').update(p).eq('id', poll.id); if (error) setErr(error.message); reload() }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-bold text-navy-800 text-lg leading-snug">{poll.question}</h3>
        {closed && <span className="inline-flex items-center gap-1 rounded-full bg-navy-100 text-navy-600 px-2.5 py-0.5 text-sm font-semibold shrink-0"><Lock className="h-3.5 w-3.5" />Closed</span>}
      </div>
      <p className="text-sm text-navy-500 mt-1">{poll.multiple_choice ? 'Pick any' : 'Pick one'} · {r.voters} of {members.length} voted{poll.closes_at && !closed ? ` · closes ${fmtDate(poll.closes_at.slice(0, 10))} ${new Date(poll.closes_at).toTimeString().slice(0, 5)}` : ''}</p>

      <ul className="mt-3 space-y-2">
        {options.map((o) => {
          const on = mine.has(o.id); const n = r.counts[o.id]; const voters = votes.filter((v) => v.option_id === o.id)
          return (
            <li key={o.id}>
              <button onClick={() => void cast(o.id)} disabled={closed || busy} aria-pressed={on}
                className={cx('relative w-full overflow-hidden rounded-2xl border-2 text-left px-4 py-3 min-h-[56px] disabled:cursor-default', on ? 'border-jungle-500' : 'border-sand-200 hover:border-jungle-400')}>
                <span className={cx('absolute inset-y-0 left-0 transition-all', on ? 'bg-jungle-100' : 'bg-sand-100')} style={{ width: `${r.percent[o.id]}%` }} />
                <span className="relative flex items-center gap-3">
                  <span className={cx('grid h-5 w-5 shrink-0 place-items-center border-2', poll.multiple_choice ? 'rounded-md' : 'rounded-full', on ? 'bg-jungle-500 border-jungle-500 text-white' : 'border-navy-200 bg-white')}>{on && <span className="text-xs leading-none">✓</span>}</span>
                  <span className={cx('flex-1 font-semibold', closed && n === top && n > 0 ? 'text-jungle-800' : 'text-navy-800')}>{o.label}{closed && n === top && n > 0 && <Trophy className="inline h-4 w-4 ml-1.5 -mt-0.5 text-ember-700" aria-label="Winner" />}</span>
                  <span className="tabular-nums text-navy-600 font-semibold">{n} · {r.percent[o.id]}%</span>
                </span>
              </button>
              {voters.length > 0 && <div className="flex -space-x-1.5 mt-1.5 pl-1" aria-label={`Voted: ${voters.map((v) => memberName(v.user_id)).join(', ')}`}>
                {voters.slice(0, 6).map((v) => <Avatar key={v.user_id} profile={members.find((m) => m.user_id === v.user_id)?.profile ?? null} size={22} />)}</div>}
            </li>
          )
        })}
      </ul>
      {err && <p role="alert" className="mt-2 text-red-700">{err}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ReactionBar targetType="poll" targetId={poll.id} />
        <span className="text-sm text-navy-400 ml-auto">{timeAgo(poll.created_at)}</span>
        {isAdmin && !closed && <Button variant="soft" onClick={() => confirm('Close this poll? Nobody can vote after this.') && void patch({ closed_at: new Date().toISOString() })}>Close poll</Button>}
        {isAdmin && <button onClick={() => confirm('Delete this poll?') && void patch({ deleted_at: new Date().toISOString() })} aria-label="Delete poll" className="p-2 text-navy-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </Card>
  )
}

function CreatePoll({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { trip } = useTrip()
  const [q, setQ] = useState(''); const [opts, setOpts] = useState(['', '']); const [multi, setMulti] = useState(false); const [closes, setCloses] = useState('')
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = opts.map((o) => o.trim()).filter(Boolean)
    if (!q.trim()) return setErr('Write the question.')
    if (clean.length < 2) return setErr('Add at least two options.')
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('create_poll', { p_trip: trip!.id, p_question: q.trim(), p_multiple: multi, p_closes: closes ? new Date(closes).toISOString() : null, p_options: clean })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label="New poll" onClick={(e) => e.stopPropagation()} className="glass-sheet w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold text-navy-800">New poll</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button></div>
        <Field label="Question"><input className={inputCls} maxLength={200} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Which New Year's Eve party?" required /></Field>
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-navy-700">Options</span>
          {opts.map((o, i) => (
            <div key={i} className="flex gap-2"><input className={inputCls} aria-label={`Option ${i + 1}`} maxLength={160} value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
              {opts.length > 2 && <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="p-2 text-navy-400 hover:text-red-600"><X className="h-5 w-5" /></button>}</div>
          ))}
          {opts.length < 10 && <Button type="button" variant="ghost" onClick={() => setOpts([...opts, ''])}><Plus className="h-4 w-4" />Add option</Button>}
        </div>
        <div className="grid grid-cols-2 gap-2">{[{ v: false, l: 'Single choice' }, { v: true, l: 'Multiple choice' }].map((o) => <button type="button" key={o.l} aria-pressed={multi === o.v} onClick={() => setMulti(o.v)} className={cx('min-h-[48px] rounded-xl border-2 font-semibold', multi === o.v ? 'border-jungle-500 bg-jungle-50' : 'border-sand-200 text-navy-600')}>{o.l}</button>)}</div>
        <Field label="Closes (optional)" hint="You can also close it manually any time."><input type="datetime-local" className={inputCls} value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Create poll</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}

export default function PollsTab({ data, reload }: { data: { polls: PollRow[]; options: PollOption[]; votes: PollVote[] }; reload: () => void }) {
  const { isAdmin } = useTrip()
  const [create, setCreate] = useState(false)
  const open = data.polls.filter((p) => !pollClosed(p)), closed = data.polls.filter((p) => pollClosed(p))
  const card = (p: PollRow) => <PollCard key={p.id} poll={p} options={data.options.filter((o) => o.poll_id === p.id)} votes={data.votes.filter((v) => v.poll_id === p.id)} reload={reload} />
  return (
    <div className="space-y-4">
      {isAdmin && <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" />New poll</Button>}
      {data.polls.length === 0 && <Card><EmptyState title="No polls yet" hint="Group decisions (parties, restaurants, timings) show up here." /></Card>}
      {open.map(card)}
      {closed.length > 0 && <h2 className="font-display text-xl font-bold text-navy-800 pt-2">Closed</h2>}
      {closed.map(card)}
      {create && <CreatePoll onClose={() => setCreate(false)} onDone={reload} />}
    </div>
  )
}
