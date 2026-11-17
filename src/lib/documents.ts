import type { DocumentRow } from './types'

export const DOC_CATEGORIES = [
  { value: 'flight', label: 'Flights' }, { value: 'hotel', label: 'Hotels' }, { value: 'hostel', label: 'Hostels' },
  { value: 'bus', label: 'Buses' }, { value: 'ferry', label: 'Ferries' }, { value: 'activity', label: 'Activities' },
  { value: 'insurance', label: 'Insurance' }, { value: 'entry', label: 'Entry info' },
  { value: 'emergency', label: 'Emergency' }, { value: 'misc', label: 'Other' },
] as const
export const categoryLabel = (v: string) => DOC_CATEGORIES.find((c) => c.value === v)?.label ?? v

export const MAX_BYTES = 20 * 1024 * 1024
const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
}
const ALLOWED = new Set(Object.values(EXT_MIME))
export const ACCEPT = Object.keys(EXT_MIME).map((e) => `.${e}`).join(',')

const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '')
/** Browsers sometimes give an empty MIME type (e.g. some Android files): fall back to the extension. */
export function resolveMime(f: { name: string; type: string }): string | null {
  const t = f.type && f.type !== 'application/octet-stream' ? f.type : EXT_MIME[ext(f.name)]
  return t && ALLOWED.has(t) ? t : null
}
export function validateFile(f: { name: string; type: string; size: number }): string | null {
  if (f.size === 0) return 'That file is empty.'
  if (f.size > MAX_BYTES) return 'File is too large (max 20 MB).'
  if (!resolveMime(f)) return 'Unsupported file type. Use PDF, JPG, PNG, WebP, HEIC, Word, Excel or text.'
  return null
}

/** Storage-safe filename: no path separators, no odd characters, keeps the extension. */
export function safeFilename(name: string): string {
  const e = ext(name)
  const base = (e ? name.slice(0, -(e.length + 1)) : name).normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 60) || 'file'
  return e ? `${base}.${e.replace(/[^a-z0-9]/g, '').slice(0, 5)}` : base
}

export function formatBytes(n: number | null): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export const isImage = (mime: string | null) => !!mime && mime.startsWith('image/') && mime !== 'image/heic' && mime !== 'image/heif'
export const isPdf = (mime: string | null) => mime === 'application/pdf'

/** Current documents: not deleted and not superseded by a (non-deleted) newer version. */
export function latestVersions(docs: DocumentRow[]): DocumentRow[] {
  const live = docs.filter((d) => !d.deleted_at)
  const replaced = new Set(live.map((d) => d.replaces_id).filter(Boolean) as string[])
  return live.filter((d) => !replaced.has(d.id))
}

/** Newest-first chain of versions that ends at `id` (follows replaces_id backwards through non-deleted rows). */
export function versionChain(docs: DocumentRow[], id: string): DocumentRow[] {
  const byId = new Map(docs.filter((d) => !d.deleted_at).map((d) => [d.id, d]))
  const out: DocumentRow[] = []
  const seen = new Set<string>()
  for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = cur.replaces_id ? byId.get(cur.replaces_id) : undefined) {
    out.push(cur); seen.add(cur.id)
  }
  return out
}

export function matchesSearch(d: DocumentRow, q: string, uploader: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [d.name, d.notes, categoryLabel(d.category), uploader].some((x) => x?.toLowerCase().includes(s))
}

export function newStoragePath(tripId: string, docId: string, filename: string) {
  return `${tripId}/${docId}/${safeFilename(filename)}`
}
