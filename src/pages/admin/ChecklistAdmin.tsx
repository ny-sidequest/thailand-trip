import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { useAsync } from '@/hooks/useAsync'
import { Button, Card, EmptyState, ErrorState, SectionTitle, Skeleton } from '@/components/ui'
import EditRecordSheet, { type FieldSpec } from '@/components/EditRecordSheet'
import { groupByCategory } from '@/lib/checklist'
import { fmtDate } from '@/lib/format'
import type { ChecklistItem } from '@/lib/types'

export default function ChecklistAdmin() {
  const { session } = useAuth()
  const { trip } = useTrip()
  const [edit, setEdit] = useState<ChecklistItem | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const q = useAsync(async () => unwrap(await supabase.from('checklist_items').select('id,category,title,description,due_date,sort_order').eq('trip_id', trip!.id).is('deleted_at', null).order('sort_order')) as ChecklistItem[], [trip!.id])

  async function del(i: ChecklistItem) {
    if (!confirm(`Remove “${i.title}” for everyone? Ticks already made are kept but hidden.`)) return
    const { error } = await supabase.from('checklist_items').update({ deleted_at: new Date().toISOString() }).eq('id', i.id)
    if (error) setErr(error.message); else q.reload()
  }
  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <Skeleton className="h-64" />
  const cats = [...new Set(q.data.map((i) => i.category))]
  const fields: FieldSpec[] = [
    { key: 'category', label: 'Category', type: 'text', required: true, max: 60, hint: cats.length ? `Existing: ${cats.join(', ')}. Type a new name to create a category.` : undefined },
    { key: 'title', label: 'Item', type: 'text', required: true, max: 160 }, { key: 'description', label: 'Details', type: 'textarea', max: 500 },
    { key: 'due_date', label: 'Deadline', type: 'date', hint: 'Optional. Shown to everyone; items are never ticked automatically.' },
  ]
  const maxSort = q.data.reduce((m, i) => Math.max(m, i.sort_order), 0)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between gap-3"><h1 className="font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink-50">Checklist</h1><Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add item</Button></div>
      <p className="text-ink-300">Items apply to every traveller. Each person ticks their own.</p>
      {err && <p role="alert" className="text-red-300">{err}</p>}
      {q.data.length === 0 ? <Card><EmptyState title="No items yet" /></Card> : groupByCategory(q.data).map((g) => (
        <section key={g.category}>
          <SectionTitle>{g.category}</SectionTitle>
          <Card className="divide-y divide-white/10">
            {g.items.map((i) => (
              <div key={i.id} className="flex items-center gap-2 p-3 min-h-[56px]">
                <div className="min-w-0 flex-1"><p className="font-semibold text-ink-50">{i.title}</p>{i.due_date && <p className="text-sm text-ink-300">Due {fmtDate(i.due_date)}</p>}</div>
                <button onClick={() => setEdit(i)} aria-label={`Edit ${i.title}`} className="p-2 text-ink-400 hover:text-ink-50"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => void del(i)} aria-label={`Remove ${i.title}`} className="p-2 text-ink-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </Card>
        </section>
      ))}
      {edit && <EditRecordSheet title={edit === 'new' ? 'Add checklist item' : 'Edit checklist item'} table="checklist_items" id={edit === 'new' ? undefined : edit.id} fields={fields}
        initial={edit === 'new' ? { category: cats[0] ?? '' } : (edit as unknown as Record<string, unknown>)}
        insertDefaults={{ trip_id: trip!.id, sort_order: maxSort + 1, created_by: session!.user.id }} onClose={() => setEdit(null)} onSaved={q.reload} />}
    </div>
  )
}
