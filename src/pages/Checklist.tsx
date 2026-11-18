import { useEffect, useState } from 'react'
import { Check, CalendarClock, PartyPopper } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useChecklist } from '@/hooks/useChecklist'
import { Avatar, Card, EmptyState, ErrorState, ProgressBar, SectionTitle, Skeleton, cx } from '@/components/ui'
import { dueState, groupByCategory, nextDeadline, pct } from '@/lib/checklist'
import { fmtDate } from '@/lib/format'
import type { ChecklistItem } from '@/lib/types'

function DueBadge({ item, done }: { item: ChecklistItem; done: boolean }) {
  const s = dueState(item.due_date, done)
  if (s === 'none' || s === 'done') return null
  const cls = s === 'overdue' ? 'bg-red-100 text-red-700' : s === 'soon' ? 'bg-amber-100 text-amber-800' : 'bg-navy-100 text-navy-600'
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold', cls)}><CalendarClock className="h-3.5 w-3.5" />{s === 'overdue' ? 'Overdue · ' : 'Due '}{fmtDate(item.due_date!)}</span>
}

export default function Checklist() {
  const { session } = useAuth()
  const { trip, members } = useTrip()
  const uid = session!.user.id
  const q = useChecklist(trip!.id)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { if (q.data) setDone(q.data.done) }, [q.data])

  async function toggle(item: ChecklistItem) {
    if (busy.has(item.id)) return
    const was = done.has(item.id)
    setErr(null)
    setBusy((b) => new Set(b).add(item.id))
    setDone((d) => { const n = new Set(d); was ? n.delete(item.id) : n.add(item.id); return n }) // optimistic
    const res = was
      ? await supabase.from('checklist_completions').delete().eq('item_id', item.id).eq('user_id', uid)
      : await supabase.from('checklist_completions').insert({ item_id: item.id, user_id: uid, trip_id: trip!.id })
    setBusy((b) => { const n = new Set(b); n.delete(item.id); return n })
    if (res.error && !(res.error.code === '23505' && !was)) { // duplicate tick from another device is fine
      setDone((d) => { const n = new Set(d); was ? n.add(item.id) : n.delete(item.id); return n }) // roll back
      setErr(`Couldn't save "${item.title}": ${res.error.message}`)
    } else q.reload()
  }

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  const { items, progress } = q.data
  if (items.length === 0) return <EmptyState title="No checklist items yet" hint="The trip admin hasn't added any." />

  const total = items.length
  const myDone = items.filter((i) => done.has(i.id)).length
  const next = nextDeadline(items, done)
  const groups = groupByCategory(items)
  const byUser = new Map(progress.map((p) => [p.user_id, p]))

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight text-navy-800">Checklist</h1>

      <Card className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-navy-500 font-semibold">Your progress</p>
            <p className="font-display text-5xl font-bold text-navy-800 leading-none mt-1">{pct(myDone, total)}%</p>
          </div>
          <p className="text-navy-500">{myDone} of {total} done</p>
        </div>
        <ProgressBar value={pct(myDone, total)} className="mt-4" />
        {myDone === total
          ? <p className="mt-3 flex items-center gap-2 font-semibold text-jungle-700"><PartyPopper className="h-5 w-5" />All done. You're ready to go!</p>
          : next && <p className="mt-3 text-navy-600">Next deadline: <span className="font-semibold">{next.title}</span> · {fmtDate(next.due_date!)}</p>}
      </Card>

      {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}

      {groups.map(({ category, items: list }) => {
        const d = list.filter((i) => done.has(i.id)).length
        return (
          <section key={category}>
            <SectionTitle action={<span className="text-navy-500 font-semibold">{d}/{list.length}</span>}>{category}</SectionTitle>
            <Card className="divide-y divide-sand-200/70 overflow-hidden">
              {list.map((i) => {
                const on = done.has(i.id)
                return (
                  <button key={i.id} role="checkbox" aria-checked={on} onClick={() => void toggle(i)}
                    className="w-full flex items-center gap-4 px-4 py-3 min-h-[60px] text-left hover:bg-sand-50 active:bg-sand-100 transition">
                    <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition', on ? 'bg-jungle-500 border-jungle-500 text-white' : 'border-navy-200 bg-white')}>
                      {on && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx('block font-semibold', on ? 'text-navy-400 line-through' : 'text-navy-800')}>{i.title}</span>
                      {i.description && <span className="block text-sm text-navy-500">{i.description}</span>}
                      <DueBadge item={i} done={on} />
                    </span>
                  </button>
                )
              })}
            </Card>
          </section>
        )
      })}

      <section>
        <SectionTitle>Group progress</SectionTitle>
        <Card className="p-5 space-y-4">
          {members.map((m) => {
            const p = byUser.get(m.user_id)
            const value = p ? pct(p.completed, p.total) : 0
            return (
              <div key={m.user_id}>
                <div className="flex items-center gap-3 mb-1.5">
                  <Avatar profile={m.profile} size={32} />
                  <span className="font-semibold text-navy-800 flex-1 truncate">{m.profile.display_name}{m.user_id === uid && <span className="text-navy-400 font-normal"> (you)</span>}</span>
                  <span className="font-semibold text-navy-700">{value}%</span>
                </div>
                <ProgressBar value={value} />
              </div>
            )
          })}
          <p className="text-sm text-navy-400">Only totals are shared. Nobody else sees which items you've ticked.</p>
        </Card>
      </section>
    </div>
  )
}
