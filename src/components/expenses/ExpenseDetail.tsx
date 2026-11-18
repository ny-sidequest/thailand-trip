import { useEffect, useState } from 'react'
import { ExternalLink, History, Pencil, Trash2, X } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Button, Spinner } from '@/components/ui'
import { categoryMeta, formatMoney } from '@/lib/money'
import { fmtDate, timeAgo } from '@/lib/format'
import type { Expense, ExpenseAuditRow } from '@/lib/types'

const FIELDS: [string, string][] = [['description', 'Description'], ['amount', 'Amount'], ['currency', 'Currency'], ['fx_rate_to_base', 'Rate'],
  ['category', 'Category'], ['expense_date', 'Date'], ['payer_id', 'Paid by'], ['split_type', 'Split'], ['notes', 'Notes'], ['receipt_path', 'Receipt']]

export default function ExpenseDetail({ expense: e, onClose, onEdit, onChanged }: { expense: Expense; onClose: () => void; onEdit: (e: Expense) => void; onChanged: () => void }) {
  const { session } = useAuth()
  const { trip, isAdmin, memberName } = useTrip()
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const base = trip!.base_currency
  const canEdit = e.created_by === session!.user.id || (isAdmin && !e.is_personal)
  const cat = categoryMeta(e.category)

  const audit = useAsync(async () => unwrap(await supabase.from('expense_audit').select('id,action,changed_by,changed_at,old_row,new_row').eq('expense_id', e.id).order('id', { ascending: false })) as unknown as ExpenseAuditRow[], [e.id, e.updated_at])
  useEffect(() => {
    if (!e.receipt_path) return setUrl(null)
    let alive = true
    supabase.storage.from('receipts').createSignedUrl(e.receipt_path, 300).then(({ data }) => alive && setUrl(data?.signedUrl ?? null))
    return () => { alive = false }
  }, [e.receipt_path])

  async function remove() {
    if (!confirm(`Delete “${e.description}”? Balances will update. The deletion stays in the audit trail.`)) return
    const { error } = await supabase.rpc('delete_expense', { p_id: e.id })
    if (error) return setErr(error.message)
    onChanged(); onClose()
  }

  const show = (k: string, v: unknown) => (k === 'payer_id' ? memberName(String(v)) : v == null || v === '' ? '—' : String(v))
  function changes(a: ExpenseAuditRow): string[] {
    if (a.action === 'delete') return ['Deleted']
    if (a.action === 'insert') return ['Created']
    const out: string[] = []
    for (const [k, label] of FIELDS) if (JSON.stringify(a.old_row?.[k]) !== JSON.stringify(a.new_row?.[k])) out.push(`${label}: ${show(k, a.old_row?.[k])} → ${show(k, a.new_row?.[k])}`)
    if (JSON.stringify(a.old_row?.splits_snapshot) !== JSON.stringify(a.new_row?.splits_snapshot)) out.push('Split changed')
    return out.length ? out : ['Edited']
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-label={e.description} onClick={(ev) => ev.stopPropagation()} className="glass-sheet w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ember-700 inline-flex items-center gap-1"><cat.icon className="h-4 w-4" />{cat.label}{e.is_personal ? ' · Personal' : ''}</p>
            <h2 className="font-display text-xl font-bold text-navy-800 break-words">{e.description}</h2>
            <p className="font-display text-3xl font-bold text-navy-800 mt-1">{formatMoney(e.amount, e.currency)}</p>
            {e.currency !== base && <p className="text-navy-500">{formatMoney(e.amount_base, base)} at 1 {e.currency} = {e.fx_rate_to_base} {base}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-navy-600">{fmtDate(e.expense_date, { day: 'numeric', month: 'short', year: 'numeric' })} · paid by <span className="font-semibold">{memberName(e.payer_id)}</span> · added by {memberName(e.created_by)}</p>

        <div>
          <h3 className="font-semibold text-navy-800 mb-1">Split ({e.split_type === 'equal' ? 'equally' : e.split_type === 'percentage' ? 'by percentage' : 'by amount'})</h3>
          <ul className="rounded-2xl border border-sand-200 divide-y divide-sand-200">
            {e.splits.map((s) => <li key={s.user_id} className="flex justify-between px-4 py-2.5"><span className="text-navy-800">{memberName(s.user_id)}{s.percentage != null ? ` · ${s.percentage}%` : ''}</span><span className="tabular-nums text-navy-700">{formatMoney(s.share_amount, e.currency)}</span></li>)}
          </ul>
        </div>
        {e.notes && <p className="text-navy-700 whitespace-pre-wrap">{e.notes}</p>}

        {e.receipt_path && (
          <div>
            <h3 className="font-semibold text-navy-800 mb-1">Receipt</h3>
            {!url ? <Spinner label="Opening securely…" /> : /\.pdf$/i.test(e.receipt_path)
              ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-jungle-700 font-semibold min-h-[44px]"><ExternalLink className="h-4 w-4" />Open PDF receipt</a>
              : <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Receipt" className="max-h-72 w-full object-contain rounded-2xl bg-sand-100" /></a>}
          </div>
        )}

        {canEdit && <div className="flex gap-2"><Button variant="soft" onClick={() => onEdit(e)}><Pencil className="h-4 w-4" />Correct</Button><Button variant="ghost" className="text-red-600" onClick={() => void remove()}><Trash2 className="h-4 w-4" />Delete</Button></div>}
        {err && <p role="alert" className="text-red-700">{err}</p>}

        <div>
          <h3 className="font-semibold text-navy-800 flex items-center gap-2 mb-2"><History className="h-4 w-4" />Audit trail</h3>
          {audit.loading && !audit.data ? <Spinner /> : (
            <ul className="space-y-2">
              {audit.data?.map((a) => (
                <li key={a.id} className="rounded-xl bg-sand-50 px-4 py-2.5 text-sm">
                  <p className="text-navy-500"><span className="font-semibold text-navy-800">{memberName(a.changed_by)}</span> · {timeAgo(a.changed_at)}</p>
                  {changes(a).map((c, i) => <p key={i} className="text-navy-700 break-words">{c}</p>)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
