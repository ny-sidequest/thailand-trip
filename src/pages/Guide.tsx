import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, WifiOff, X } from 'lucide-react'
import { useTrip } from '@/context/TripContext'
import { useGuide } from '@/hooks/useGuide'
import { CATEGORIES, categoryLabel, filterGuide, guideCities, sortGuide, type GuideCategory, type GuideItem } from '@/lib/guide'
import { Card, EmptyState, ErrorState, Skeleton, cx, inputCls } from '@/components/ui'
import { GuideBody, GuideLinks, GuidePhoto, PhotoCredit } from '@/components/GuideBits'

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cx('shrink-0 rounded-full px-4 min-h-[44px] font-semibold transition', on ? 'bg-gradient-to-b from-jungle-500 to-jungle-700 text-white' : 'glass-chip text-ink-100')}>{children}</button>
  )
}

function ItemCard({ item, onOpen }: { item: GuideItem; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="glass hover-lift text-left rounded-3xl overflow-hidden w-full flex flex-col active:scale-[.99] transition">
      {item.photo_path && <GuidePhoto item={item} className="h-36 w-full object-cover" />}
      <span className="p-4 space-y-1 block">
        <span className="eyebrow">{categoryLabel(item.category)} · {item.city}</span>
        <span className="block font-display text-lg font-medium text-ink-50 leading-snug">{item.title}</span>
        <span className="block text-ink-300">{item.summary}</span>
      </span>
    </button>
  )
}

export function GuideSheet({ item, onClose }: { item: GuideItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <article role="dialog" aria-modal="true" aria-label={item.title} onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl safe-bottom">
        {item.photo_path && <GuidePhoto item={item} className="h-48 sm:h-64 w-full object-cover" />}
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="eyebrow">{categoryLabel(item.category)} · {item.city}</p><h2 className="font-display text-2xl font-medium text-ink-50 leading-snug">{item.title}</h2></div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 shrink-0"><X className="h-5 w-5" /></button>
          </div>
          <p className="text-ink-200 text-lg">{item.summary}</p>
          <GuideBody body={item.body} />
          <GuideLinks item={item} />
          <PhotoCredit item={item} />
        </div>
      </article>
    </div>
  )
}

export default function Guide() {
  const { trip } = useTrip()
  const q = useGuide(trip!.id)
  const { itemId } = useParams()
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<GuideCategory | 'all'>('all')
  const [city, setCity] = useState('all')
  const items = useMemo(() => sortGuide(q.data?.items ?? []), [q.data])
  const cities = useMemo(() => guideCities(items), [items])
  const shown = useMemo(() => filterGuide(items, { query, category: cat, city }), [items, query, cat, city])
  const open = itemId ? items.find((i) => i.id === itemId) : undefined
  const grouped = cat === 'all' && !query.trim()

  return (
    <div className="space-y-5">
      <div><h1 className="font-display text-[1.75rem] sm:text-[2rem] font-medium tracking-tight text-ink-50">Destination guide</h1>
        <p className="text-ink-300">Check-in, getting around, SIM and money, places and safety. Facts marked "confirm" change often: check before you rely on them.</p></div>
      {q.data?.savedAt && <p role="status" className="rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-2 text-amber-100 inline-flex items-center gap-2"><WifiOff className="h-4 w-4" />Offline copy saved {new Date(q.data.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400" aria-hidden="true" />
        <input type="search" aria-label="Search the guide" placeholder="Search: eSIM, taxi, Wat Arun…" className={`${inputCls} pl-12`} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0" role="group" aria-label="Category">
        <Chip on={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
        {CATEGORIES.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
      </div>
      {cities.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0" role="group" aria-label="City">
          <Chip on={city === 'all'} onClick={() => setCity('all')}>All places</Chip>
          {cities.map((c) => <Chip key={c} on={city === c} onClick={() => setCity(c)}>{c}</Chip>)}
        </div>
      )}
      {q.loading && !q.data ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
        : q.error && !q.data ? <ErrorState message={q.error} onRetry={q.reload} />
        : shown.length === 0 ? <Card><EmptyState title="Nothing matches" hint="Try a different word, or clear the filters." /></Card>
        : grouped ? (
          <div className="space-y-7">
            {CATEGORIES.map((c) => { const list = shown.filter((i) => i.category === c.id); return list.length > 0 && (
              <section key={c.id} aria-label={c.label}>
                <div className="mb-2"><h2 className="font-display text-xl font-medium text-ink-50">{c.label}</h2><p className="text-ink-400">{c.blurb}</p></div>
                <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">{list.map((i) => <ItemCard key={i.id} item={i} onOpen={() => nav(`/guide/${i.id}`)} />)}</div>
              </section>) })}
          </div>
        ) : <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">{shown.map((i) => <ItemCard key={i.id} item={i} onOpen={() => nav(`/guide/${i.id}`)} />)}</div>}
      {open && <GuideSheet item={open} onClose={() => nav('/guide')} />}
    </div>
  )
}
