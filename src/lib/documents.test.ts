import { describe, it, expect } from 'vitest'
import { latestVersions, matchesSearch, resolveMime, safeFilename, validateFile, versionChain, formatBytes } from './documents'
import type { DocumentRow } from './types'

const doc = (id: string, o: Partial<DocumentRow> = {}) =>
  ({ id, name: id, category: 'flight', notes: null, replaces_id: null, deleted_at: null, version: 1, ...o }) as DocumentRow

describe('documents helpers', () => {
  it('validates type and size', () => {
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toBeNull()
    expect(validateFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 })).toMatch(/Unsupported/)
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 30 * 1024 * 1024 })).toMatch(/too large/)
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/empty/)
  })
  it('falls back to the extension when the browser gives no type', () => {
    expect(resolveMime({ name: 'Ticket.PDF', type: '' })).toBe('application/pdf')
    expect(resolveMime({ name: 'x.zip', type: '' })).toBeNull()
  })
  it('does not trust an HTML file renamed .pdf with an html type', () => {
    expect(resolveMime({ name: 'evil.pdf', type: 'text/html' })).toBeNull()
  })
  it('sanitises filenames (no path traversal)', () => {
    expect(safeFilename('../../etc/passwd.pdf')).toBe('etc_passwd.pdf')
    expect(safeFilename('Hotel Confirmation (Bangkok) #1.PDF')).toBe('Hotel_Confirmation_Bangkok_1.pdf')
    expect(safeFilename('...')).toBe('file')
  })
  it('latest versions hide superseded and deleted rows', () => {
    const d = [doc('v1'), doc('v2', { replaces_id: 'v1', version: 2 }), doc('other'), doc('gone', { deleted_at: 'x' })]
    expect(latestVersions(d).map((x) => x.id).sort()).toEqual(['other', 'v2'])
  })
  it('deleting the newest version restores the previous one', () => {
    const d = [doc('v1'), doc('v2', { replaces_id: 'v1', deleted_at: 'x' })]
    expect(latestVersions(d).map((x) => x.id)).toEqual(['v1'])
  })
  it('builds a newest-first version chain', () => {
    const d = [doc('v1'), doc('v2', { replaces_id: 'v1' }), doc('v3', { replaces_id: 'v2' })]
    expect(versionChain(d, 'v3').map((x) => x.id)).toEqual(['v3', 'v2', 'v1'])
  })
  it('search covers name, notes, category, uploader', () => {
    const d = doc('x', { name: 'Hotel Bangkok', notes: 'late check-in' })
    expect(matchesSearch(d, 'bangkok', '')).toBe(true); expect(matchesSearch(d, 'LATE', '')).toBe(true)
    expect(matchesSearch(d, 'flights', '')).toBe(true); expect(matchesSearch(d, 'ravi', 'Ravi')).toBe(true)
    expect(matchesSearch(d, 'phuket', '')).toBe(false)
  })
  it('formats bytes', () => { expect(formatBytes(512)).toBe('512 B'); expect(formatBytes(2048)).toBe('2 KB'); expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB') })
})
