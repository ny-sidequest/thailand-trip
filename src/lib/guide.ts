import { safeUrl } from './format'

export type GuideCategory = 'before' | 'airport' | 'getting-around' | 'places' | 'essentials' | 'safety'
export interface GuideLink { label: string; url: string }
export interface GuideItem {
  id: string; trip_id: string; category: GuideCategory; city: string; title: string; summary: string; body: string
  links: GuideLink[]; day_numbers: number[]; pinned: boolean; sort_order: number
  photo_path: string | null; photo_credit: string | null; photo_license: string | null; photo_license_url: string | null; photo_source_url: string | null
}

export const CATEGORIES: { id: GuideCategory; label: string; blurb: string }[] = [
  { id: 'before', label: 'Before you fly', blurb: 'Check-in, entry rules, forms and packing' },
  { id: 'airport', label: 'Airports', blurb: 'Bengaluru and Bangkok, in and out' },
  { id: 'getting-around', label: 'Getting around', blurb: 'Cabs, buses, ferries and trains' },
  { id: 'places', label: 'Places', blurb: 'What to see, with practical notes' },
  { id: 'essentials', label: 'Essentials', blurb: 'SIM, money, power, weather, manners' },
  { id: 'safety', label: 'Safety', blurb: 'Emergency numbers, rules and scams' },
]
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c

/** Body format: blank-line separated paragraphs, "- " bullets, "**Heading**" lines, inline **bold**. No HTML is ever interpreted. */
export type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }

export function parseBody(body: string): Block[] {
  const blocks: Block[] = []
  let list: string[] | null = null
  const flush = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null } }
  for (const raw of body.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const bullet = /^[-•]\s+(.*)$/.exec(line)
    if (bullet) { (list ??= []).push(bullet[1]); continue }
    flush()
    const h = /^\*\*([^*]+)\*\*:?$/.exec(line)
    blocks.push(h ? { type: 'h', text: h[1] } : { type: 'p', text: line })
  }
  flush()
  return blocks
}

/** Splits text into plain and bold runs for inline **bold**. */
export function inlineRuns(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = []
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return
    const m = /^\*\*([^*]+)\*\*$/.exec(part)
    out.push(m ? { text: m[1], bold: true } : { text: part, bold: false })
  })
  return out
}

export function filterGuide(items: GuideItem[], o: { query?: string; category?: GuideCategory | 'all'; city?: string }): GuideItem[] {
  const q = (o.query ?? '').trim().toLowerCase()
  return items.filter((i) => {
    if (o.category && o.category !== 'all' && i.category !== o.category) return false
    if (o.city && o.city !== 'all' && i.city !== o.city && i.city !== 'Everywhere') return false
    if (!q) return true
    return `${i.title} ${i.summary} ${i.body} ${i.city}`.toLowerCase().includes(q)
  })
}

export const sortGuide = (items: GuideItem[]) =>
  [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sort_order - b.sort_order)

/** Items tied to a given itinerary day (day_numbers contains it). */
export const guideForDay = (items: GuideItem[], dayNumber: number) =>
  items.filter((i) => i.day_numbers.includes(dayNumber)).sort((a, b) => a.sort_order - b.sort_order)

export function guideCities(items: GuideItem[]): string[] {
  return [...new Set(items.map((i) => i.city))].filter((c) => c !== 'Everywhere')
}

export const photoUrl = (path: string | null, base = import.meta.env.BASE_URL) =>
  path && /^guide\/[a-z0-9-]+\.webp$/.test(path) ? `${base}${path}` : null

/** Admin editor: "Label | https://…" per line <-> links array. Throws a readable message on bad input. */
export function linksFromText(text: string): GuideLink[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [label, ...rest] = l.split('|')
    const url = rest.join('|').trim()
    if (!label.trim() || !url) throw new Error(`Link line needs "Label | https://…": ${l.slice(0, 40)}`)
    if (!/^https:\/\//i.test(url) || !safeUrl(url)) throw new Error(`Links must start with https://: ${url.slice(0, 40)}`)
    return { label: label.trim(), url }
  })
}
export const linksToText = (links: GuideLink[]) => links.map((l) => `${l.label} | ${l.url}`).join('\n')

export function dayNumbersFromText(text: string): number[] {
  const nums = text.split(/[,\s]+/).filter(Boolean).map(Number)
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 60)) throw new Error('Days must be whole numbers like 1, 2, 3')
  return [...new Set(nums)].sort((a, b) => a - b)
}
