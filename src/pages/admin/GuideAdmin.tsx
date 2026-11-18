import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { supabase, unwrap } from '@/lib/supabase'
import { useTrip } from '@/context/TripContext'
import { useAuth } from '@/context/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { Button, Card, EmptyState, ErrorState, SectionTitle, Spinner } from '@/components/ui'
import EditRecordSheet, { type FieldSpec } from '@/components/EditRecordSheet'
import { CATEGORIES, categoryLabel, dayNumbersFromText, linksFromText, linksToText, sortGuide, type GuideItem } from '@/lib/guide'

const FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', type: 'text', required: true, max: 160 },
  { key: 'category', label: 'Section', type: 'select', required: true, options: CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
  { key: 'city', label: 'City', type: 'text', required: true, max: 40, hint: 'Use "Everywhere" for tips that apply on the whole trip' },
  { key: 'summary', label: 'One-line summary', type: 'text', max: 300 },
  { key: 'body', label: 'Details', type: 'textarea', max: 8000, hint: 'Blank line between paragraphs. Start lines with "- " for bullets. **Heading** on its own line makes a heading.' },
  { key: 'links_text', label: 'Links', type: 'textarea', max: 2000, hint: 'One per line: Label | https://…' },
  { key: 'days_text', label: 'Show on itinerary days', type: 'text', max: 60, hint: 'Day numbers, like 1, 2' },
  { key: 'pinned', label: 'Pin to the top', type: 'boolean' },
  { key: 'sort_order', label: 'Order', type: 'number' },
]

export default function GuideAdmin() {
  const { trip } = useTrip()
  const { session } = useAuth()
  const [edit, setEdit] = useState<GuideItem | 'new' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const q = useAsync(async () => sortGuide(unwrap(await supabase.from('guide_items').select('*').eq('trip_id', trip!.id).is('deleted_at', null).order('sort_order')) as GuideItem[]), [trip!.id])

  async function remove(i: GuideItem) {
    if (!window.confirm(`Remove "${i.title}" from the guide?`)) return
    setErr(null)
    const { data, error } = await supabase.from('guide_items').update({ deleted_at: new Date().toISOString() }).eq('id', i.id).select('id')
    if (error || !data?.length) return setErr(error?.message ?? 'Not removed: admin only.')
    q.reload()
  }
  const toDb = (p: Record<string, unknown>) => {
    const { links_text, days_text, ...rest } = p
    return { ...rest, summary: rest.summary ?? '', body: rest.body ?? '', sort_order: rest.sort_order ?? 0, links: linksFromText(String(links_text ?? '')), day_numbers: dayNumbersFromText(String(days_text ?? '')) }
  }

  return (
    <div className="space-y-4">
      <SectionTitle action={<Button variant="soft" onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add</Button>}>Destination guide</SectionTitle>
      <p className="text-ink-300">Edits are shared with everyone instantly. Only add facts you have checked, and say "confirm" where something may change. <Link to="/guide" className="text-jungle-300 font-semibold">View the guide</Link></p>
      {err && <p role="alert" className="rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 text-red-200">{err}</p>}
      {q.error ? <ErrorState message={q.error} onRetry={q.reload} /> : !q.data ? <Spinner /> : q.data.length === 0 ? <Card><EmptyState title="No guide items yet" /></Card> : (
        <Card className="divide-y divide-white/10">
          {q.data.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-50 truncate">{i.pinned && <Pin className="inline h-4 w-4 mr-1 text-ember-300" aria-label="Pinned" />}{i.title}</p>
                <p className="text-sm text-ink-400">{categoryLabel(i.category)} · {i.city}{i.day_numbers.length ? ` · Day ${i.day_numbers.join(', ')}` : ''}</p>
              </div>
              <button onClick={() => setEdit(i)} aria-label={`Edit ${i.title}`} className="p-2.5 rounded-xl hover:bg-white/10"><Pencil className="h-[18px] w-[18px]" /></button>
              <button onClick={() => void remove(i)} aria-label={`Remove ${i.title}`} className="p-2.5 rounded-xl hover:bg-red-500/15 text-red-300"><Trash2 className="h-[18px] w-[18px]" /></button>
            </div>
          ))}
        </Card>
      )}
      <p className="text-sm text-ink-400">Photos are image files shipped with the app, so they can be changed by a developer only.</p>
      {edit && (
        <EditRecordSheet title={edit === 'new' ? 'Add guide item' : 'Edit guide item'} table="guide_items" id={edit === 'new' ? undefined : edit.id}
          fields={FIELDS} mapPatch={toDb}
          initial={edit === 'new' ? { category: 'places', city: 'Everywhere', pinned: false, sort_order: (q.data?.length ?? 0) + 1 } : { ...edit, links_text: linksToText(edit.links), days_text: edit.day_numbers.join(', ') }}
          insertDefaults={{ trip_id: trip!.id, created_by: session!.user.id }}
          onClose={() => setEdit(null)} onSaved={q.reload} />
      )}
    </div>
  )
}
