import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Camera, Lock, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Avatar, Button, Field, cx, inputCls } from '@/components/ui'
import { EXPENSE_CATEGORIES, defaultRate, formatMoney, parseAmount } from '@/lib/money'
import { fromMinor, splitEqual, splitWeighted, toMinor } from '@/lib/settle'
import { safeFilename } from '@/lib/documents'
import type { Currency, Expense } from '@/lib/types'

type SplitType = 'equal' | 'custom' | 'percentage'
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: React.ReactNode }[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }} role="group">
      {options.map((o) => (
        <button type="button" key={o.v} aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className={cx('min-h-[48px] rounded-xl border-2 px-2 font-semibold inline-flex items-center justify-center gap-1.5', value === o.v ? 'border-jungle-500 bg-jungle-50 text-navy-800' : 'border-sand-200 text-navy-600')}>{o.icon}{o.label}</button>
      ))}
    </div>
  )
}

export default function ExpenseSheet({ expense, onClose, onDone }: { expense?: Expense; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth()
  const { trip, members } = useTrip()
  const uid = session!.user.id
  const base = trip!.base_currency
  const editing = !!expense

  const [desc, setDesc] = useState(expense?.description ?? '')
  const [amountStr, setAmountStr] = useState(expense ? String(expense.amount) : '')
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? 'THB')
  const [rateStr, setRateStr] = useState(String(expense ? expense.fx_rate_to_base : defaultRate('THB', base, trip!.default_thb_to_inr)))
  const [date, setDate] = useState(expense?.expense_date ?? today())
  const [category, setCategory] = useState(expense?.category ?? 'food')
  const [payer, setPayer] = useState(expense?.payer_id ?? uid)
  const [personal, setPersonal] = useState(expense?.is_personal ?? false)
  const [selected, setSelected] = useState<string[]>(expense ? expense.splits.map((s) => s.user_id) : members.map((m) => m.user_id))
  const [type, setType] = useState<SplitType>(expense?.split_type ?? 'equal')
  const [custom, setCustom] = useState<Record<string, string>>(Object.fromEntries((expense?.splits ?? []).map((s) => [s.user_id, String(s.share_amount)])))
  const [pcts, setPcts] = useState<Record<string, string>>(Object.fromEntries((expense?.splits ?? []).map((s) => [s.user_id, s.percentage != null ? String(s.percentage) : ''])))
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [keepReceipt, setKeepReceipt] = useState(!!expense?.receipt_path)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const expenseId = useRef(expense?.id ?? crypto.randomUUID())   // stable across retries: a double-tap cannot create two rows
  const submitting = useRef(false)

  const needsRate = currency !== base
  const amount = parseAmount(amountStr)
  const rate = needsRate ? Number(rateStr) : 1
  const baseAmount = Number.isFinite(amount) && rate > 0 ? Math.round(amount * rate * 100) / 100 : NaN
  const people = personal ? [uid] : selected

  function changeCurrency(c: Currency) {
    setCurrency(c)
    if (c !== base) setRateStr(String(defaultRate(c, base, trip!.default_thb_to_inr)))
  }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  // live preview of each person's share (minor units, exact)
  const calc = useMemo(() => {
    if (!Number.isFinite(amount) || amount <= 0 || people.length === 0) return { shares: null as Record<string, number> | null, problem: null as string | null }
    const total = toMinor(amount)
    try {
      if (personal || type === 'equal') return { shares: splitEqual(total, people), problem: null }
      if (type === 'custom') {
        const shares: Record<string, number> = {}
        for (const id of people) { const v = parseAmount(custom[id] ?? '0'); shares[id] = Number.isNaN(v) ? NaN : toMinor(v) }
        const sum = Object.values(shares).reduce((a, b) => a + b, 0)
        if (Object.values(shares).some(Number.isNaN)) return { shares: null, problem: 'Enter valid amounts for everyone.' }
        return { shares, problem: sum === total ? null : `Shares add up to ${formatMoney(sum / 100, currency)}; they need to total ${formatMoney(amount, currency)}.` }
      }
      const w: Record<string, number> = {}
      for (const id of people) w[id] = Number(pcts[id] || 0)
      const sum = Object.values(w).reduce((a, b) => a + b, 0)
      if (Object.values(w).some((x) => !(x >= 0))) return { shares: null, problem: 'Percentages must be valid numbers.' }
      if (Math.abs(sum - 100) > 0.001) return { shares: null, problem: `Percentages add up to ${Math.round(sum * 1000) / 1000}%; they need to total 100%.` }
      return { shares: splitWeighted(total, w), problem: null }
    } catch (e) { return { shares: null, problem: e instanceof Error ? e.message : 'Invalid split' } }
  }, [amount, people.join(','), type, custom, pcts, personal, currency]) // eslint-disable-line react-hooks/exhaustive-deps

  function pickReceipt(f: File | undefined) {
    if (!f) return
    const t = f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '')
    if (!RECEIPT_TYPES.includes(t)) return setErr('Receipt must be a photo (JPG, PNG, WebP, HEIC) or PDF.')
    if (f.size > 10 * 1024 * 1024) return setErr('Receipt must be under 10 MB.')
    setErr(null); setReceipt(f)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting.current) return
    if (!desc.trim()) return setErr('Add a description.')
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter a valid amount (max 2 decimals).')
    if (needsRate && !(rate > 0)) return setErr('Enter the exchange rate you are using.')
    if (people.length === 0) return setErr('Choose at least one person to split with.')
    if (calc.problem || !calc.shares) return setErr(calc.problem ?? 'Check the split.')
    submitting.current = true; setBusy(true); setErr(null)

    let receiptPath: string | null = keepReceipt ? expense?.receipt_path ?? null : null
    let uploaded: string | null = null
    if (receipt) {
      const path = `${trip!.id}/${expenseId.current}/${safeFilename(receipt.name)}`
      const up = await supabase.storage.from('receipts').upload(path, receipt, { contentType: receipt.type || 'application/pdf', upsert: false })
      if (up.error) { submitting.current = false; setBusy(false); return setErr(`Receipt upload failed: ${up.error.message}`) }
      uploaded = path; receiptPath = path
    }
    const payload = {
      description: desc.trim(), category, amount, currency, fx_rate: needsRate ? rate : null, expense_date: date,
      payer_id: personal ? uid : payer, split_type: personal ? 'equal' : type, is_personal: personal, notes: notes.trim() || null,
      receipt_path: receiptPath,
      splits: people.map((id) => ({ user_id: id, share_amount: fromMinor(calc.shares![id]), percentage: !personal && type === 'percentage' ? Number(pcts[id]) : null })),
    }
    const { error } = await supabase.rpc('save_expense', { p_trip: trip!.id, p_id: expenseId.current, p: payload })
    if (error) {
      if (uploaded) await supabase.storage.from('receipts').remove([uploaded])
      submitting.current = false; setBusy(false); return setErr(error.message)
    }
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label={editing ? 'Edit expense' : 'Add expense'} onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy-800">{editing ? 'Correct expense' : 'Add expense'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>

        <Field label="What was it for?"><input className={inputCls} value={desc} maxLength={160} onChange={(e) => setDesc(e.target.value)} placeholder="Dinner at Yaowarat" required /></Field>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="Amount"><input className={inputCls} inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0.00" required aria-invalid={amountStr !== '' && Number.isNaN(amount)} /></Field>
          <div className="w-[132px]"><Seg value={currency} onChange={changeCurrency} options={[{ v: 'THB', label: '฿ THB' }, { v: 'INR', label: '₹ INR' }]} /></div>
        </div>
        {amountStr !== '' && Number.isNaN(amount) && <p className="text-red-700 text-sm -mt-2">Use numbers only, up to 2 decimals.</p>}

        {needsRate && (
          <div className="rounded-2xl bg-sand-100 p-4 space-y-2">
            <Field label={`Exchange rate: 1 ${currency} = ? ${base}`} hint="Recorded with this expense. Change it if you paid at a different rate.">
              <input className={inputCls} inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />
            </Field>
            {Number.isFinite(baseAmount) && <p className="font-semibold text-navy-800">= {formatMoney(baseAmount, base)}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label="Category">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>{EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          </Field>
        </div>

        {!editing && <Seg value={personal ? 'p' : 's'} onChange={(v) => setPersonal(v === 'p')} options={[{ v: 's', label: 'Shared', icon: <Users className="h-4 w-4" /> }, { v: 'p', label: 'Personal', icon: <Lock className="h-4 w-4" /> }]} />}
        {personal && <p className="text-sm text-navy-500 -mt-2">Personal expenses are visible only to you and never affect group balances.</p>}

        {!personal && (
          <>
            <Field label="Paid by">
              <select className={inputCls} value={payer} onChange={(e) => setPayer(e.target.value)}>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.display_name}{m.user_id === uid ? ' (you)' : ''}</option>)}</select>
            </Field>

            <fieldset>
              <div className="flex items-center justify-between mb-1.5">
                <legend className="text-sm font-semibold text-navy-700">Split between</legend>
                <button type="button" className="text-jungle-700 font-semibold min-h-[40px]" onClick={() => setSelected(selected.length === members.length ? [] : members.map((m) => m.user_id))}>{selected.length === members.length ? 'Clear' : 'Select all'}</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => {
                  const on = selected.includes(m.user_id)
                  return (
                    <button type="button" key={m.user_id} role="checkbox" aria-checked={on} onClick={() => toggle(m.user_id)}
                      className={cx('flex items-center gap-2 rounded-xl border-2 px-3 min-h-[52px] text-left', on ? 'border-jungle-500 bg-jungle-50' : 'border-sand-200')}>
                      <Avatar profile={m.profile} size={28} /><span className="font-semibold text-navy-800 truncate">{m.profile.display_name}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <Seg value={type} onChange={setType} options={[{ v: 'equal', label: 'Equal' }, { v: 'custom', label: 'Amounts' }, { v: 'percentage', label: 'Percent' }]} />
          </>
        )}

        {people.length > 0 && Number.isFinite(amount) && (
          <ul className="rounded-2xl border border-sand-200 divide-y divide-sand-200">
            {people.map((id) => {
              const m = members.find((x) => x.user_id === id)!
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-2 min-h-[52px]">
                  <span className="flex-1 font-semibold text-navy-800 truncate">{m.profile.display_name}</span>
                  {!personal && type === 'custom' && <input aria-label={`${m.profile.display_name} amount`} className={`${inputCls} !w-28 !min-h-[40px] text-right`} inputMode="decimal" value={custom[id] ?? ''} onChange={(e) => setCustom({ ...custom, [id]: e.target.value })} placeholder="0.00" />}
                  {!personal && type === 'percentage' && <span className="inline-flex items-center gap-1"><input aria-label={`${m.profile.display_name} percent`} className={`${inputCls} !w-20 !min-h-[40px] text-right`} inputMode="decimal" value={pcts[id] ?? ''} onChange={(e) => setPcts({ ...pcts, [id]: e.target.value })} placeholder="0" /><span className="text-navy-500">%</span></span>}
                  <span className="w-24 text-right text-navy-600 tabular-nums">{calc.shares ? formatMoney(calc.shares[id] / 100, currency) : '—'}</span>
                </li>
              )
            })}
          </ul>
        )}
        {calc.problem && <p role="status" className="text-amber-800 bg-amber-50 rounded-xl px-4 py-2">{calc.problem}</p>}

        <div>
          <span className="block text-sm font-semibold text-navy-700 mb-1.5">Receipt (optional)</span>
          <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-sand-300 bg-sand-50 px-4 min-h-[56px] cursor-pointer">
            <Camera className="h-5 w-5 text-navy-400" />
            <span className="flex-1 truncate text-navy-700 font-semibold">{receipt ? receipt.name : keepReceipt ? 'Current receipt kept. Tap to replace' : 'Take a photo or choose a file'}</span>
            <input type="file" accept="image/*,application/pdf" capture={undefined} hidden onChange={(e) => pickReceipt(e.target.files?.[0])} />
          </label>
          {(receipt || keepReceipt) && <button type="button" className="text-red-600 font-semibold min-h-[40px]" onClick={() => { setReceipt(null); setKeepReceipt(false) }}>Remove receipt</button>}
        </div>

        <Field label="Notes (optional)"><textarea className={`${inputCls} min-h-[72px] py-3`} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        {editing && <p className="text-sm text-navy-500">Corrections are saved with a full audit trail: the old values stay on record.</p>}
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">{editing ? 'Save correction' : 'Add expense'}</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
