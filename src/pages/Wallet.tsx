import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileImage, FileText, Lock, Plus, Search } from 'lucide-react'
import { useTrip } from '@/context/TripContext'
import { useWalletData } from '@/hooks/useWalletData'
import { Button, Card, EmptyState, ErrorState, Skeleton, cx, inputCls } from '@/components/ui'
import UploadDocumentSheet, { type UploadPreset } from '@/components/wallet/UploadDocumentSheet'
import DocumentViewer from '@/components/wallet/DocumentViewer'
import { StayList, TransportList } from '@/components/wallet/BookingCards'
import { DOC_CATEGORIES, categoryLabel, isImage, latestVersions, matchesSearch } from '@/lib/documents'
import { fmtDate } from '@/lib/format'
import type { DocumentRow } from '@/lib/types'

const TABS = [{ to: '/wallet', label: 'Documents', key: '' }, { to: '/wallet/stays', label: 'Stays', key: 'stays' }, { to: '/wallet/transport', label: 'Transport', key: 'transport' }]

export default function Wallet() {
  const { trip, memberName } = useTrip()
  const tab = useParams()['*'] ?? ''
  const q = useWalletData(trip!.id)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState<DocumentRow | null>(null)
  const [upload, setUpload] = useState<{ preset?: UploadPreset; replaces?: DocumentRow } | null>(null)

  const current = useMemo(() => latestVersions(q.data?.docs ?? []), [q.data])
  const shown = current.filter((d) => (!cat || d.category === cat) && matchesSearch(d, search, memberName(d.uploaded_by)))

  if (q.error) return <ErrorState message={q.error} onRetry={q.reload} />
  if (!q.data) return <div className="space-y-4"><Skeleton className="h-12" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
  const { docs, stays, transport, activityBookings } = q.data
  const counts = new Map<string, number>()
  for (const d of current) counts.set(d.category, (counts.get(d.category) ?? 0) + 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-navy-800">Travel Wallet</h1>
        <Button onClick={() => setUpload({})}><Plus className="h-4 w-4" />Upload</Button>
      </div>

      <nav className="flex gap-2 glass rounded-2xl p-1.5" aria-label="Wallet sections">
        {TABS.map((t) => (
          <Link key={t.key} to={t.to} aria-current={tab === t.key ? 'page' : undefined}
            className={cx('flex-1 text-center rounded-xl min-h-[44px] grid place-items-center font-semibold', tab === t.key ? 'bg-gradient-to-b from-navy-600 to-navy-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_6px_14px_-6px_rgba(11,31,58,.65)]' : 'text-navy-600 hover:bg-sand-100')}>{t.label}</Link>
        ))}
      </nav>

      {tab === '' && (
        <>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-400" />
            <input className={`${inputCls} pl-11`} type="search" placeholder="Search documents" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search documents" />
          </div>
          <div className="-mx-4 px-4 lg:mx-0 lg:px-0 flex gap-2 overflow-x-auto pb-1">
            {[{ value: '', label: 'All' }, ...DOC_CATEGORIES.filter((c) => counts.has(c.value))].map((c) => (
              <button key={c.value} onClick={() => setCat(c.value)} aria-pressed={cat === c.value}
                className={cx('shrink-0 rounded-full px-4 min-h-[40px] font-semibold border', cat === c.value ? 'bg-gradient-to-b from-navy-600 to-navy-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.22),0_6px_14px_-6px_rgba(11,31,58,.65)] border-navy-800' : 'glass-chip text-navy-700')}>
                {c.label}{c.value ? ` ${counts.get(c.value)}` : ` ${current.length}`}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <Card><EmptyState icon={<FileText className="h-8 w-8" />} title={current.length === 0 ? 'No documents yet' : 'No matches'} hint={current.length === 0 ? 'Upload tickets, confirmations and insurance. Only trip members can open them.' : 'Try a different search or category.'} /></Card>
          ) : (
            <Card className="divide-y divide-sand-200/70 overflow-hidden">
              {shown.map((d) => (
                <button key={d.id} onClick={() => setOpen(d)} className="w-full text-left flex items-center gap-3 px-4 py-3 min-h-[68px] hover:bg-sand-50">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand-100 text-navy-600">{isImage(d.mime_type) ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-navy-800 truncate">{d.name}</span>
                    <span className="block text-sm text-navy-500 truncate">{categoryLabel(d.category)}{d.related_date ? ` · ${fmtDate(d.related_date)}` : ''} · {memberName(d.uploaded_by)}</span>
                  </span>
                  {d.version > 1 && <span className="rounded-full bg-navy-100 text-navy-600 px-2 py-0.5 text-sm font-semibold">v{d.version}</span>}
                  {d.visibility === 'private' && <Lock className="h-4 w-4 text-navy-400 shrink-0" aria-label="Only you" />}
                </button>
              ))}
            </Card>
          )}
        </>
      )}
      {tab === 'stays' && <StayList stays={stays} docs={current} onOpen={setOpen} onAdd={(preset) => setUpload({ preset })} reload={q.reload} />}
      {tab === 'transport' && <TransportList items={transport} docs={current} onOpen={setOpen} onAdd={(preset) => setUpload({ preset })} reload={q.reload} />}

      {open && <DocumentViewer doc={open} allDocs={docs} onClose={() => setOpen(null)} onChanged={q.reload}
        onReplace={(d) => { setOpen(null); setUpload({ replaces: d }) }} />}
      {upload && <UploadDocumentSheet {...upload} stays={stays} transport={transport} activityBookings={activityBookings} onClose={() => setUpload(null)} onDone={q.reload} />}
    </div>
  )
}
