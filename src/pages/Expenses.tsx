import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, HandCoins, Lock, Paperclip, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useExpenses } from '@/hooks/useExpenses'
import { Avatar, Button, Card, EmptyState, ErrorState, SectionTitle, Skeleton, cx } from '@/components/ui'
import ExpenseSheet from '@/components/expenses/ExpenseSheet'
import ExpenseDetail from '@/components/expenses/ExpenseDetail'
import SettlementSheet from '@/components/expenses/SettlementSheet'
import { categoryMeta, formatMinor, formatMoney } from '@/lib/money'
import { computeLedger, suggestSettlements, toMinor } from '@/lib/settle'
import { fmtDate, fmtDateLong } from '@/lib/format'
import type { Currency, Expense } from '@/lib/types'

const TABS = [{ to: '/expenses', label: 'Overview', key: '' }, { to: '/expenses/history', label: 'History', key: 'history' }]

export default function Expenses() {
  const { session } = useAuth()
  const { trip, members, memberName, isAdmin } = useTrip()
  const uid = session!.user.id
  const base = trip!.base_currency
  const tab = useParams()['*'] ?? ''
  const q = useExpenses(trip!.id)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [open, setOpen] = useState<Expense | null>(null)
  const [settle, setSettle] = useState<{ from: string; to: string; amount: number } | 'blank' | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine' | 'personal'>('all')

  const calc = useMemo(() => {
    if (!q.data) return null
    try {
      const userIds = members.map((m) => m.user_id)
      const shared = q.data.expenses.filter((e) => !e.is_personal)
      const ledger = computeLedger(
        shared.map((e) => ({ payer_id: e.payer_id, amount: e.amount, amount_base: e.amount_base, is_personal: false, deleted_at: null, splits: e.splits })),
        q.data.settlements.map((s) => ({ from_user: s.from_user, to_user: s.to_user, amount: s.amount, fx_rate_to_base: s.fx_rate_to_base, deleted_at: null })), userIds)
      const transfers = suggestSettlements(Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.net])))
      const byCcy: Record<string, number> = {}
      let totalBase = 0
      for (const e of shared) { byCcy[e.currency] = (byCcy[e.currency] ?? 0) + toMinor(e.amount); totalBase += toMinor(e.amount_base) }
      const personal = q.data.expenses.filter((e) => e.is_personal && e.created_by === uid).reduce((s, e) => s + toMinor(e.amount_base), 0)
      return { ledger, transfers, byCcy, totalBase, personal, count: shared.length, error: null as string | null }
    } catch (e) { return { error: e instanceof Error ? e.message : 'Could not compute balances' } as never }
  }, [q.data, members, uid])

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data || !calc) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
  if (calc.error) return <ErrorState message={`Balance calculation failed: ${calc.error}`} onRetry={q.reload} />
  const { expenses, settlements } = q.data
  const me = calc.ledger[uid]
  const myNet = me?.net ?? 0
  const thbPerBase = base === 'INR' ? 1 / trip!.default_thb_to_inr : trip!.default_thb_to_inr

  const openLive = open ? expenses.find((e) => e.id === open.id) ?? null : null   // follows realtime edits
  const mineShare = (e: Expense) => e.splits.find((s) => s.user_id === uid)?.share_amount
  const list = expenses.filter((e) => filter === 'all' ? true : filter === 'personal' ? e.is_personal : !e.is_personal && (e.payer_id === uid || e.splits.some((s) => s.user_id === uid)))
  const byDate = list.reduce<Record<string, Expense[]>>((acc, e) => { (acc[e.expense_date] ??= []).push(e); return acc }, {})

  async function undoSettlement(id: string) {
    if (!confirm('Remove this recorded payment? Balances will update.')) return
    const { error } = await supabase.rpc('delete_settlement', { p_id: id })
    if (error) alert(error.message); else q.reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink-50">Expenses</h1>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Add</Button>
      </div>
      <nav className="flex gap-2 glass rounded-2xl p-1.5" aria-label="Expense sections">
        {TABS.map((t) => <Link key={t.key} to={t.to} aria-current={tab === t.key ? 'page' : undefined} className={cx('flex-1 text-center rounded-xl min-h-[44px] grid place-items-center font-semibold', tab === t.key ? 'bg-gradient-to-b from-jungle-500 to-jungle-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(31,157,107,.75)]' : 'text-ink-200 hover:bg-white/[.07]')}>{t.label}</Link>)}
      </nav>

      {tab === '' && (
        <>
          <Card className={cx('p-5', myNet > 0 ? 'bg-jungle-500/10 border-jungle-400/30' : myNet < 0 ? 'bg-ember-500/10 border-ember-400/20' : '')}>
            <p className="font-semibold text-ink-200">Your balance</p>
            <p className={cx('font-display text-4xl font-bold mt-1', myNet > 0 ? 'text-jungle-300' : myNet < 0 ? 'text-ember-300' : 'text-ink-50')}>{myNet === 0 ? 'All settled' : formatMinor(Math.abs(myNet), base)}</p>
            <p className="text-ink-200">{myNet > 0 ? 'The group owes you' : myNet < 0 ? 'You owe the group' : 'Nothing owed either way'}</p>
            {calc.personal > 0 && <p className="mt-2 text-sm text-ink-300 inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Your personal spending (private): {formatMinor(calc.personal, base)}</p>}
          </Card>

          <section>
            <SectionTitle>Group spending</SectionTitle>
            <Card className="p-5">
              {calc.count === 0 ? <EmptyState title="No shared expenses yet" hint="Tap Add to record the first one." /> : (
                <>
                  <p className="font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink-50">{formatMinor(calc.totalBase, base)}</p>
                  <p className="text-ink-300">{calc.count} shared expense{calc.count === 1 ? '' : 's'}, converted using each expense's recorded rate</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(Object.entries(calc.byCcy) as [Currency, number][]).map(([c, v]) => <span key={c} className="rounded-full bg-white/[.07] px-3 py-1 font-semibold text-ink-50">{formatMinor(v, c)} spent in {c}</span>)}
                  </div>
                </>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Suggested settlements</SectionTitle>
            <Card className="divide-y divide-white/10">
              {calc.transfers.length === 0 ? <EmptyState icon={<HandCoins className="h-8 w-8" />} title="Everyone is settled up" /> : calc.transfers.map((t, i) => {
                const canRecord = t.from === uid || t.to === uid || isAdmin
                return (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-50">{memberName(t.from)}</span><ArrowRight className="h-4 w-4 text-ember-500 shrink-0" aria-label="pays" /><span className="font-semibold text-ink-50">{memberName(t.to)}</span>
                      </div>
                      <p className="mt-0.5"><span className="font-display text-xl font-medium text-ink-50 num">{formatMinor(t.amount, base)}</span>{base === 'INR' && <span className="ml-2 text-xs text-ink-300">≈ {formatMoney(t.amount / 100 * thbPerBase, 'THB')} at {trip!.default_thb_to_inr}/฿</span>}</p>
                    </div>
                    {canRecord && <Button variant="soft" onClick={() => setSettle({ from: t.from, to: t.to, amount: t.amount / 100 })}>Record</Button>}
                  </div>
                )
              })}
            </Card>
            <p className="text-sm text-ink-400 mt-2">This is the smallest number of payments that settles everyone. Paid already? Tap Record so balances update.</p>
            <Button variant="ghost" className="mt-1" onClick={() => setSettle('blank')}>Record a different payment</Button>
          </section>

          <section>
            <SectionTitle>Everyone</SectionTitle>
            <Card className="divide-y divide-white/10">
              {members.map((m) => {
                const r = calc.ledger[m.user_id]
                return (
                  <div key={m.user_id} className="p-4">
                    <div className="flex items-center gap-3"><Avatar profile={m.profile} size={36} /><span className="flex-1 font-semibold text-ink-50 truncate">{m.profile.display_name}</span>
                      <span className={cx('font-bold tabular-nums', r.net > 0 ? 'text-jungle-300' : r.net < 0 ? 'text-ember-300' : 'text-ink-300')}>{r.net > 0 ? '+' : r.net < 0 ? '−' : ''}{formatMinor(Math.abs(r.net), base)}</span></div>
                    <p className="mt-1 text-sm text-ink-300 pl-12">Paid {formatMinor(r.paid, base)} · Share {formatMinor(r.owed, base)}{r.sent || r.received ? ` · Settled out ${formatMinor(r.sent, base)}, in ${formatMinor(r.received, base)}` : ''}</p>
                  </div>
                )
              })}
            </Card>
          </section>

          <section>
            <SectionTitle>Payments made</SectionTitle>
            <Card className="divide-y divide-white/10">
              {settlements.length === 0 ? <EmptyState title="No payments recorded yet" /> : settlements.map((s) => (
                <div key={s.id} className="p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1"><p className="text-ink-50"><span className="font-semibold">{memberName(s.from_user)}</span> paid <span className="font-semibold">{memberName(s.to_user)}</span></p>
                    <p className="text-sm text-ink-300">{fmtDate(s.settled_on)}{s.note ? ` · ${s.note}` : ''}{s.currency !== base ? ` · at ${s.fx_rate_to_base}` : ''}</p></div>
                  <span className="font-bold tabular-nums text-ink-50">{formatMoney(s.amount, s.currency)}</span>
                  {(s.created_by === uid || isAdmin) && <button onClick={() => void undoSettlement(s.id)} aria-label="Remove payment" className="p-2 text-ink-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </Card>
          </section>
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="flex gap-2">{([['all', 'All'], ['mine', 'Involving me'], ['personal', 'Personal']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={cx('rounded-full px-4 min-h-[40px] font-semibold border', filter === k ? 'bg-gradient-to-b from-jungle-500 to-jungle-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_8px_20px_-8px_rgba(31,157,107,.75)] border-transparent' : 'glass-chip text-ink-100')}>{l}</button>))}</div>
          {list.length === 0 ? <Card><EmptyState title="No expenses here yet" /></Card> : Object.entries(byDate).map(([d, items]) => (
            <section key={d}>
              <h2 className="text-sm font-semibold text-ink-300 mb-2">{fmtDateLong(d)}</h2>
              <Card className="divide-y divide-white/10 overflow-hidden">
                {items.map((e) => {
                  const c = categoryMeta(e.category); const share = mineShare(e)
                  return (
                    <button key={e.id} onClick={() => setOpen(e)} className="w-full text-left flex items-center gap-3 px-4 py-3 min-h-[68px] hover:bg-white/[.04]">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.07] text-ink-200"><c.icon className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink-50 truncate">{e.description}</span>
                        <span className="block text-sm text-ink-300 truncate">{e.is_personal ? 'Personal' : `${memberName(e.payer_id)} paid`}{share != null && !e.is_personal ? ` · your share ${formatMoney(share, e.currency)}` : ''}</span>
                      </span>
                      {e.receipt_path && <Paperclip className="h-4 w-4 text-ink-400" aria-label="Has receipt" />}
                      {e.is_personal && <Lock className="h-4 w-4 text-ink-400" aria-label="Personal" />}
                      <span className="text-right"><span className="block font-bold tabular-nums text-ink-50">{formatMoney(e.amount, e.currency)}</span>{e.currency !== base && <span className="block text-xs text-ink-400 tabular-nums">{formatMoney(e.amount_base, base)}</span>}</span>
                    </button>
                  )
                })}
              </Card>
            </section>
          ))}
        </>
      )}

      {adding && <ExpenseSheet onClose={() => setAdding(false)} onDone={q.reload} />}
      {editing && <ExpenseSheet expense={editing} onClose={() => setEditing(null)} onDone={() => { q.reload(); setOpen(null) }} />}
      {openLive && !editing && <ExpenseDetail expense={openLive} onClose={() => setOpen(null)} onEdit={(e) => setEditing(e)} onChanged={q.reload} />}
      {settle && <SettlementSheet preset={settle === 'blank' ? undefined : settle} existing={settlements} onClose={() => setSettle(null)} onDone={q.reload} />}
    </div>
  )
}
