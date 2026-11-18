import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileText, History, Lock, Pencil, RefreshCw, Trash2, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTrip } from '@/context/TripContext'
import { Button, Spinner } from '@/components/ui'
import EditRecordSheet from '@/components/EditRecordSheet'
import { DOC_CATEGORIES, categoryLabel, formatBytes, isImage, isPdf, versionChain } from '@/lib/documents'
import { fmtDate } from '@/lib/format'
import type { DocumentRow } from '@/lib/types'

export default function DocumentViewer({ doc, allDocs, onClose, onReplace, onChanged }: {
  doc: DocumentRow; allDocs: DocumentRow[]; onClose: () => void; onReplace: (d: DocumentRow) => void; onChanged: () => void
}) {
  const { session } = useAuth()
  const { isAdmin, memberName } = useTrip()
  const [cur, setCur] = useState(doc)
  const [url, setUrl] = useState<string | null>(null)
  const [urlErr, setUrlErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { setCur(allDocs.find((d) => d.id === cur.id) ?? cur) }, [allDocs]) // pick up edits live
  useEffect(() => {
    let alive = true
    setUrl(null); setUrlErr(null)
    // short-lived signed URL: private bucket, access re-checked by storage RLS at signing time
    supabase.storage.from('documents').createSignedUrl(cur.storage_path, 300).then(({ data, error }) => {
      if (!alive) return
      if (error || !data) setUrlErr(error?.message ?? 'Could not open this file.')
      else setUrl(data.signedUrl)
    })
    return () => { alive = false }
  }, [cur.storage_path])

  const mine = cur.uploaded_by === session!.user.id
  const canManage = mine || (isAdmin && cur.visibility === 'group')
  const chain = versionChain(allDocs, cur.id)
  const isNewest = !allDocs.some((d) => d.replaces_id === cur.id && !d.deleted_at)
  const ext = cur.storage_path.split('.').pop() ?? ''

  async function download() {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(cur.storage_path, 60, { download: `${cur.name}.${ext}` })
    if (error || !data) return setErr(error?.message ?? 'Download failed')
    window.location.href = data.signedUrl
  }
  async function remove() {
    if (!confirm(`Delete “${cur.name}” (v${cur.version})?`)) return
    const { data, error } = await supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', cur.id).select('id')
    if (error || !data?.length) return setErr(error?.message ?? 'You can only delete your own documents.')
    onChanged(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div role="dialog" aria-label={cur.name} onClick={(e) => e.stopPropagation()} className="glass-sheet w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 space-y-4 safe-bottom">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-navy-800 break-words">{cur.name}</h2>
            <p className="text-sm text-navy-500">{categoryLabel(cur.category)} · v{cur.version}{cur.size_bytes ? ` · ${formatBytes(cur.size_bytes)}` : ''}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-navy-600">
              {cur.visibility === 'private' ? <><Lock className="h-3.5 w-3.5" />Only you can see this</> : <><Users className="h-3.5 w-3.5" />Shared with the group</>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 -mr-2"><X className="h-5 w-5" /></button>
        </div>

        {/* Preview */}
        <div className="rounded-2xl bg-sand-100 overflow-hidden min-h-[160px] grid place-items-center">
          {urlErr ? <p className="p-4 text-red-700">{urlErr}</p>
            : !url ? <Spinner label="Opening securely…" />
            : isImage(cur.mime_type) ? <img src={url} alt={cur.name} className="max-h-[60vh] w-full object-contain" />
            : isPdf(cur.mime_type) ? <iframe src={url} title={cur.name} className="w-full h-[60vh] bg-white" />
            : <div className="p-6 text-center text-navy-600"><FileText className="mx-auto h-10 w-10 text-navy-400" /><p className="mt-2">No preview for this file type. Use Download.</p></div>}
        </div>

        <div className="flex flex-wrap gap-2">
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-jungle-600 text-white px-4 min-h-[44px] font-semibold hover:bg-jungle-700"><ExternalLink className="h-4 w-4" />Open</a>}
          <Button variant="soft" onClick={() => void download()}><Download className="h-4 w-4" />Download</Button>
          {canManage && isNewest && <Button variant="soft" onClick={() => onReplace(cur)}><RefreshCw className="h-4 w-4" />New version</Button>}
          {canManage && <Button variant="soft" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>}
          {canManage && <Button variant="ghost" className="text-red-600" onClick={() => void remove()}><Trash2 className="h-4 w-4" />Delete</Button>}
        </div>
        {err && <p role="alert" className="text-red-700">{err}</p>}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-navy-400 font-semibold">Uploaded by</dt><dd className="text-navy-800">{memberName(cur.uploaded_by)}</dd></div>
          <div><dt className="text-navy-400 font-semibold">Uploaded</dt><dd className="text-navy-800">{fmtDate(cur.created_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
          {cur.related_date && <div><dt className="text-navy-400 font-semibold">Related date</dt><dd className="text-navy-800">{fmtDate(cur.related_date, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>}
          {cur.traveller_id && <div><dt className="text-navy-400 font-semibold">For</dt><dd className="text-navy-800">{memberName(cur.traveller_id)}</dd></div>}
        </dl>
        {cur.notes && <p className="text-navy-700 whitespace-pre-wrap">{cur.notes}</p>}

        {chain.length > 1 && (
          <div>
            <h3 className="font-semibold text-navy-800 flex items-center gap-2 mb-2"><History className="h-4 w-4" />Version history</h3>
            <ul className="divide-y divide-sand-200 rounded-2xl border border-sand-200">
              {chain.map((v) => (
                <li key={v.id}><button onClick={() => setCur(v)} className="w-full text-left px-4 py-3 min-h-[48px] flex justify-between gap-3 hover:bg-sand-50" aria-current={v.id === cur.id}>
                  <span className={v.id === cur.id ? 'font-semibold text-navy-800' : 'text-navy-700'}>v{v.version}{v.notes ? ` · ${v.notes}` : ''}</span>
                  <span className="text-navy-400 shrink-0">{memberName(v.uploaded_by)} · {fmtDate(v.created_at.slice(0, 10))}</span>
                </button></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {editing && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditRecordSheet title="Edit document" table="documents" id={cur.id} initial={cur as unknown as Record<string, unknown>} onClose={() => setEditing(false)} onSaved={onChanged}
            fields={[
              { key: 'name', label: 'Name', type: 'text', required: true, max: 160 },
              { key: 'category', label: 'Category', type: 'select', required: true, options: DOC_CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
              { key: 'related_date', label: 'Related date', type: 'date' },
              { key: 'notes', label: 'Notes', type: 'textarea', max: 1000 },
              { key: 'visibility', label: 'Visibility', type: 'select', required: true, hint: 'Only the uploader can switch a document to private.',
                options: [{ value: 'group', label: 'Whole group' }, { value: 'private', label: 'Only me' }] },
            ]} />
        </div>
      )}
    </div>
  )
}
