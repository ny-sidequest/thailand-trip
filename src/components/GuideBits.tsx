import { ExternalLink } from 'lucide-react'
import { inlineRuns, parseBody, photoUrl, type GuideItem } from '@/lib/guide'
import { safeUrl } from '@/lib/format'

export function GuidePhoto({ item, className }: { item: Pick<GuideItem, 'photo_path' | 'title'>; className?: string }) {
  const src = photoUrl(item.photo_path)
  if (!src) return null
  return <img src={src} alt="" loading="lazy" decoding="async" className={className} />
}

function Inline({ text }: { text: string }) {
  return <>{inlineRuns(text).map((r, i) => r.bold ? <strong key={i} className="font-semibold text-ink-50">{r.text}</strong> : <span key={i}>{r.text}</span>)}</>
}

/** Renders the guide body markup as React elements only (no innerHTML). */
export function GuideBody({ body }: { body: string }) {
  return (
    <div className="space-y-3 text-ink-100 leading-relaxed">
      {parseBody(body).map((b, i) =>
        b.type === 'h' ? <h4 key={i} className="eyebrow !text-jungle-300 pt-2">{b.text}</h4>
        : b.type === 'ul' ? <ul key={i} className="space-y-1.5 pl-4 list-disc marker:text-jungle-400">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>
        : <p key={i}><Inline text={b.text} /></p>)}
    </div>
  )
}

export function GuideLinks({ item }: { item: Pick<GuideItem, 'links'> }) {
  if (!item.links.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {item.links.map((l) => { const u = safeUrl(l.url); return u && (
        <a key={l.url} href={u} target="_blank" rel="noopener noreferrer" className="glass-chip rounded-2xl px-3.5 min-h-[44px] inline-flex items-center gap-2 font-semibold text-jungle-300">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />{l.label}
        </a>) })}
    </div>
  )
}

export function PhotoCredit({ item }: { item: Pick<GuideItem, 'photo_path' | 'photo_credit' | 'photo_license' | 'photo_license_url' | 'photo_source_url'> }) {
  if (!item.photo_path) return null
  const src = safeUrl(item.photo_source_url); const lic = safeUrl(item.photo_license_url)
  return (
    <p className="text-xs text-ink-400">
      Photo: {item.photo_credit ?? 'unknown author'}
      {item.photo_license && <>, {lic ? <a href={lic} target="_blank" rel="noopener noreferrer" className="underline">{item.photo_license}</a> : item.photo_license}</>}
      {src && <> · <a href={src} target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a></>}
    </p>
  )
}
