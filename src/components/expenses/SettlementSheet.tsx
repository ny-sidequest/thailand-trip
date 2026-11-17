import { useRef, useState, type FormEvent } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Button, Field, cx, inputCls } from '@/components/ui'
import { defaultRate, formatMoney, parseAmount } from '@/lib/money'
import type { Currency, Settlement } from '@/lib/types'

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function SettlementSheet({ preset, existing, onClose, onDone }: {
  preset?: { from: string; to: string; amount: number }; existing: Settlement[]; onClose: () => void; onDone: () => void
}) {
  const { session } = useAuth()
  const { trip, members, isAdmin } = useTrip()
  const uid = session!.user.id
  const base = trip!.base_currency
  const [from, setFrom] = useState(preset?.from ?? uid)
  const [to, setTo] = useState(preset?.to ?? members.find((m) => m.user_id !== uid)?.user_id ?? '')
  const [amountStr, setAmountStr] = useState(preset ? String(preset.amount) : '')
  const [currency, setCurrency] = useState<Currency>(base)
  const [rateStr, setRateStr] = useState('1')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const key = useRef(crypto.randomUUID())   // idempotency key: retries / double taps can never record it twice
  const done = useRef(false)

  const amount = parseAmount(amountStr)
  const rate = currency === base ? 1 : Number(rateStr)
  const involved = from === uid || to === uid || isAdmin

  function pickCurrency(c: Currency) { setCurrency(c); setRateStr(String(defaultRate(c, base, trip!.default_thb_to_inr))) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (done.current) return
    if (from === to) return setErr('Choose two different people.')
    if (!Number.isFinite(amount) || amount <= 0) return setErr('Enter a valid amount.')
    if (!(rate > 0)) return setErr('Enter the exchange rate.')
    if (!involved) return setErr('You can only record payments you made or received.')
    const dayAgo = Date.now() - 86_400_000
    const dup = existing.find((s) => s.from_user === from && s.to_user === to && s.amount === amount && s.currency === currency && new Date(s.created_at).getTime() > dayAgo)
    if (dup && !confirm('A payment with the same people and amount was already recorded in the last 24 hours. Record it again?')) return
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('record_settlement', {
      p_trip: trip!.id, p_from: from, p_to: to, p_amount: amount, p_currency: currency, p_rate: currency === base ? 1 : rate,
      p_note: note.trim() || null, p_date: date, p_key: key.current,
    })
    setBusy(false)
    if (error) return setErr(error.message)   // replays of the same key succeed server-side, so no special case is needed
    done.current = true
    onDone(); onClose()
  }

  const sel = (v: string, set: (s: string) => void, label: string) => (
    <Field label={label}><select className={inputCls} value={v} onChange={(e) => set(e.target.value)}>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profile.display_name}{m.user_id === uid ? ' (you)' : ''}</option>)}</select></Field>
  )
  return (
    <div className="fixed inset-0 z-50 bg-navy-900/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} role="dialog" aria-label="Record payment" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold text-navy-800">Record a payment</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button></div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">{sel(from, setFrom, 'Who paid')}<ArrowRight className="mb-4 h-5 w-5 text-navy-300" />{sel(to, setTo, 'Who received')}</div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="Amount"><input className={inputCls} inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0.00" required /></Field>
          <div className="grid grid-cols-2 gap-2 w-[150px]">
            {(['INR', 'THB'] as Currency[]).map((c) => <button type="button" key={c} aria-pressed={currency === c} onClick={() => pickCurrency(c)} className={cx('min-h-[48px] rounded-xl border-2 font-semibold', currency === c ? 'border-jungle-500 bg-jungle-50' : 'border-sand-200 text-navy-600')}>{c}</button>)}
          </div>
        </div>
        {currency !== base && <Field label={`Rate: 1 ${currency} = ? ${base}`} hint="Recorded with this payment."><input className={inputCls} inputMode="decimal" value={rateStr} onChange={(e) => setRateStr(e.target.value)} />{Number.isFinite(amount) && rate > 0 && <span className="block mt-1 font-semibold text-navy-800">= {formatMoney(amount * rate, base)}</span>}</Field>}
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Note (optional)"><input className={inputCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="UPI, cash…" /></Field>
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Record payment</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
