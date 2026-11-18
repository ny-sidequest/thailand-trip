import { describe, expect, it } from 'vitest'
import { dayNumbersFromText, filterGuide, guideCities, guideForDay, inlineRuns, linksFromText, linksToText, parseBody, photoUrl, sortGuide, type GuideItem } from './guide'

const mk = (o: Partial<GuideItem>): GuideItem => ({ id: 'x', trip_id: 't', category: 'places', city: 'Bangkok', title: 't', summary: '', body: '', links: [], day_numbers: [], pinned: false, sort_order: 1, photo_path: null, photo_credit: null, photo_license: null, photo_license_url: null, photo_source_url: null, ...o })

describe('parseBody', () => {
  it('splits paragraphs, headings and bullets', () => {
    expect(parseBody('Intro line\n\n**How**\n- one\n- two\n\nEnd')).toEqual([
      { type: 'p', text: 'Intro line' }, { type: 'h', text: 'How' }, { type: 'ul', items: ['one', 'two'] }, { type: 'p', text: 'End' }])
  })
  it('handles CRLF, empty input and a trailing list', () => {
    expect(parseBody('')).toEqual([])
    expect(parseBody('a\r\n- b')).toEqual([{ type: 'p', text: 'a' }, { type: 'ul', items: ['b'] }])
  })
  it('does not treat a bold run inside a sentence as a heading', () => {
    expect(parseBody('We **land** late')).toEqual([{ type: 'p', text: 'We **land** late' }])
  })
  it('keeps html as plain text (never interpreted)', () => {
    expect(parseBody('<img src=x onerror=alert(1)>')).toEqual([{ type: 'p', text: '<img src=x onerror=alert(1)>' }])
  })
})

describe('inlineRuns', () => {
  it('marks bold runs', () => {
    expect(inlineRuns('a **b** c')).toEqual([{ text: 'a ', bold: false }, { text: 'b', bold: true }, { text: ' c', bold: false }])
  })
})

describe('filter / sort / day', () => {
  const items = [mk({ id: '1', title: 'Wat Arun', city: 'Bangkok', sort_order: 2 }), mk({ id: '2', title: 'SIM', city: 'Everywhere', category: 'essentials', sort_order: 1, pinned: true, day_numbers: [1] }), mk({ id: '3', title: 'Patong', city: 'Phuket', body: 'beach', day_numbers: [4, 5] })]
  it('filters by text across title, summary and body', () => {
    expect(filterGuide(items, { query: 'BEACH' }).map((i) => i.id)).toEqual(['3'])
  })
  it('city filter keeps Everywhere items', () => {
    expect(filterGuide(items, { city: 'Bangkok' }).map((i) => i.id)).toEqual(['1', '2'])
  })
  it('category filter and "all"', () => {
    expect(filterGuide(items, { category: 'essentials' }).map((i) => i.id)).toEqual(['2'])
    expect(filterGuide(items, { category: 'all', city: 'all' })).toHaveLength(3)
  })
  it('pinned first, then sort_order', () => { expect(sortGuide(items).map((i) => i.id)).toEqual(['2', '3', '1']) })
  it('items for a day', () => { expect(guideForDay(items, 4).map((i) => i.id)).toEqual(['3']); expect(guideForDay(items, 9)).toEqual([]) })
  it('cities exclude Everywhere', () => { expect(guideCities(items).sort()).toEqual(['Bangkok', 'Phuket']) })
})

describe('photoUrl', () => {
  it('builds a base-relative url for valid paths only', () => {
    expect(photoUrl('guide/a-b.webp', '/trip/')).toBe('/trip/guide/a-b.webp')
    expect(photoUrl('../x.webp', '/')).toBeNull()
    expect(photoUrl('https://evil.test/a.webp', '/')).toBeNull()
    expect(photoUrl(null, '/')).toBeNull()
  })
})

describe('admin text helpers', () => {
  it('round-trips links', () => {
    const l = linksFromText('Site | https://a.test/x?y=1\n\nOther | https://b.test')
    expect(l).toEqual([{ label: 'Site', url: 'https://a.test/x?y=1' }, { label: 'Other', url: 'https://b.test' }])
    expect(linksFromText(linksToText(l))).toEqual(l)
  })
  it('rejects non-https and malformed link lines', () => {
    expect(() => linksFromText('x | http://a.test')).toThrow(/https/)
    expect(() => linksFromText('x | javascript:alert(1)')).toThrow(/https/)
    expect(() => linksFromText('no separator')).toThrow(/Label/)
  })
  it('parses day numbers', () => {
    expect(dayNumbersFromText('3, 1  2,2')).toEqual([1, 2, 3])
    expect(dayNumbersFromText('')).toEqual([])
    expect(() => dayNumbersFromText('a')).toThrow()
    expect(() => dayNumbersFromText('0')).toThrow()
  })
})
