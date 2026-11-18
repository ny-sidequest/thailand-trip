import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABEL } from '@/lib/format'
import type { BookingStatus, Profile } from '@/lib/types'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('glass rounded-3xl', className)}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1 min-h-[44px]">
      <h2 className="font-display text-[1.15rem] font-medium tracking-tight text-ink-50">{children}</h2>
      {action}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' | 'accent'; busy?: boolean }
export function Button({ variant = 'primary', busy, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'text-white bg-gradient-to-b from-jungle-500 to-jungle-700 shadow-[inset_0_1px_0_rgba(255,255,255,.28),0_10px_22px_-10px_rgba(31,157,107,.8)] hover:from-jungle-400 hover:to-jungle-600',
    accent: 'text-white bg-gradient-to-b from-ember-500 to-ember-600 shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_10px_22px_-8px_rgba(221,94,10,.75)] hover:from-ember-400 hover:to-ember-500',
    soft: 'glass-chip text-ink-50 hover:bg-white/[.14]',
    ghost: 'text-ink-100 hover:bg-white/10',
    danger: 'text-white bg-gradient-to-b from-red-500 to-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_18px_-8px_rgba(185,28,28,.6)]',
  }[variant]
  return (
    <button {...p} disabled={disabled || busy}
      className={cx('inline-flex items-center justify-center gap-2 rounded-2xl px-4 min-h-[44px] text-base font-semibold transition duration-200 active:scale-[.97] disabled:opacity-60 disabled:cursor-not-allowed', v, className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export const inputCls =
  'w-full rounded-2xl border border-white/15 bg-white/[.07] px-4 min-h-[48px] text-base text-ink-50 placeholder:text-ink-400 shadow-[inset_0_1px_2px_rgba(0,0,0,.25)] transition focus:outline-none focus:bg-white/[.11] focus:ring-2 focus:ring-jungle-400/70 focus:border-jungle-400/70'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-ink-100 mb-1.5 tracking-tight">{label}</span>
      {children}
      {hint && <span className="block text-sm text-ink-400 mt-1">{hint}</span>}
    </label>
  )
}

const STATUS_STYLE: Record<BookingStatus, { box: string; dot: string }> = {
  confirmed: { box: 'bg-jungle-500/15 text-jungle-200 ring-jungle-400/35', dot: 'bg-jungle-400' },
  pending: { box: 'bg-amber-500/15 text-amber-200 ring-amber-400/35', dot: 'bg-amber-400' },
  suggested: { box: 'bg-sky-500/15 text-sky-200 ring-sky-400/35', dot: 'bg-sky-400' },
  needs_verification: { box: 'bg-ember-500/15 text-ember-300 ring-ember-400/40', dot: 'bg-ember-400' },
  cancelled: { box: 'bg-red-500/15 text-red-300 ring-red-400/35', dot: 'bg-red-400' },
  completed: { box: 'bg-white/10 text-ink-200 ring-white/20', dot: 'bg-ink-300' },
}
export function StatusBadge({ status }: { status: BookingStatus }) {
  const st = STATUS_STYLE[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ring-1 ring-inset', st.box)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', st.dot)} />{STATUS_LABEL[status]}
    </span>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cx('h-2.5 w-full rounded-full bg-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,.35)] overflow-hidden', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-jungle-400 to-jungle-600 shadow-glow transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-ink-400"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-3xl bg-white/[.07] border border-white/10', className)} />
}
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4 text-ink-300">
      {icon && <div className="mx-auto mb-2 flex justify-center text-ink-400">{icon}</div>}
      <p className="font-semibold text-ink-100">{title}</p>
      {hint && <p className="text-base mt-1">{hint}</p>}
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl bg-red-500/10 border border-red-400/30 p-4 text-red-200 flex gap-3 items-start">
      <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
      <div className="flex-1"><p className="font-semibold">Something went wrong</p><p className="text-base break-words">{message}</p></div>
      {onRetry && <Button variant="soft" onClick={onRetry}>Retry</Button>}
    </div>
  )
}

// ---- Avatar with private-storage signed URL (cached for the session) ----
const urlCache = new Map<string, { url: string; exp: number }>()
async function signedAvatar(path: string) {
  const hit = urlCache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600)
  if (data?.signedUrl) urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3_000_000 })
  return data?.signedUrl ?? null
}
const TONES = ['bg-indigo-500', 'bg-jungle-600', 'bg-ember-500', 'bg-sky-600', 'bg-violet-500']
export function Avatar({ profile, size = 40, className }: { profile: Pick<Profile, 'id' | 'display_name' | 'avatar_path'> | null; size?: number; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const path = profile?.avatar_path
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (path) void signedAvatar(path).then((u) => alive && setUrl(u))
    return () => { alive = false }
  }, [path])
  const name = profile?.display_name ?? '?'
  const tone = TONES[[...(profile?.id ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  const style = { width: size, height: size, fontSize: size * 0.4 }
  return url
    ? <img src={url} alt={name} style={style} className={cx('rounded-full object-cover ring-2 ring-night-800 shadow-sm', className)} />
    : <span style={style} aria-label={name} className={cx('inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-night-800', tone, className)}>{name.slice(0, 1).toUpperCase()}</span>
}
