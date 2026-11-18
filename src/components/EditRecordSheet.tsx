import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button, Field, inputCls } from '@/components/ui'
import { safeUrl } from '@/lib/format'

export interface FieldSpec {
  key: string; label: string; type: 'text' | 'textarea' | 'date' | 'time' | 'url' | 'select' | 'number' | 'boolean'
  options?: { value: string; label: string }[]; hint?: string; required?: boolean; max?: number
}

/** Generic admin/owner editor for one row. Authorisation is RLS: an unauthorised update affects 0 rows and is reported. */
export default function EditRecordSheet({ title, subtitle, table, id, fields, initial, insertDefaults, stampUpdatedBy, onClose, onSaved }: {
  title: string; subtitle?: string; table: string; id?: string; fields: FieldSpec[]
  initial: Record<string, unknown>; insertDefaults?: Record<string, unknown>; stampUpdatedBy?: boolean; onClose: () => void; onSaved: () => void
}) {
  const { session } = useAuth()
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((x) => [x.key, x.type === 'time' ? String(initial[x.key] ?? '').slice(0, 5) : x.type === 'boolean' ? String(!!initial[x.key]) : String(initial[x.key] ?? '')])))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    const patch: Record<string, unknown> = {}
    for (const x of fields) {
      const v = f[x.key].trim()
      if (x.required && !v) return setErr(`${x.label} is required.`)
      if (x.type === 'url' && v && !safeUrl(v)) return setErr(`${x.label} must start with http:// or https://`)
      if (x.type === 'number' && v !== '' && !Number.isFinite(Number(v))) return setErr(`${x.label} must be a number.`)
      patch[x.key] = v === '' ? null : x.type === 'number' ? Number(v) : x.type === 'boolean' ? v === 'true' : v
    }
    if (stampUpdatedBy) patch.updated_by = session!.user.id
    setBusy(true); setErr(null)
    const { data, error } = id
      ? await supabase.from(table).update(patch).eq('id', id).select('id')
      : await supabase.from(table).insert({ ...insertDefaults, ...patch }).select('id')
    setBusy(false)
    if (error) return setErr(error.code === '42501' ? 'Only the trip admin can do this.' : error.message)
    if (!data?.length) return setErr('Not saved: you do not have permission to edit this.')
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={save} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy-800">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>
        {subtitle && <p className="text-navy-500 -mt-2">{subtitle}</p>}
        {fields.map((x) => (
          <Field key={x.key} label={x.label} hint={x.hint}>
            {x.type === 'boolean' ? (
              <select className={inputCls} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select>
            ) : x.type === 'select' ? (
              <select className={inputCls} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })}>
                {!x.required && <option value="">—</option>}
                {x.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : x.type === 'textarea' ? (
              <textarea className={`${inputCls} min-h-[84px] py-3`} maxLength={x.max ?? 2000} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />
            ) : (
              <input className={inputCls} type={x.type === 'url' ? 'text' : x.type === 'number' ? 'text' : x.type} inputMode={x.type === 'url' ? 'url' : x.type === 'number' ? 'decimal' : undefined} maxLength={x.max ?? 300}
                value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} required={x.required} />
            )}
          </Field>
        ))}
        {err && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{err}</p>}
        <div className="flex gap-3"><Button type="submit" busy={busy} className="flex-1">Save</Button><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button></div>
      </form>
    </div>
  )
}
