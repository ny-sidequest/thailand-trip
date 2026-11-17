import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { STATUS_LABEL } from '@/lib/format'
import type { BookingStatus, Profile } from '@/lib/types'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl bg-white shadow-card border border-sand-200/60', className)}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2 className="font-display text-xl font-bold text-navy-800">{children}</h2>
      {action}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; busy?: boolean }
export function Button({ variant = 'primary', busy, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700 shadow-sm',
    soft: 'bg-sand-100 text-navy-800 hover:bg-sand-200',
    ghost: 'text-navy-700 hover:bg-navy-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }[variant]
  return (
    <button {...p} disabled={disabled || busy}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-[44px] text-base font-semibold transition active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed', v, className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export const inputCls =
  'w-full rounded-xl border border-sand-300 bg-white px-4 min-h-[48px] text-base text-navy-900 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-jungle-400 focus:border-jungle-400'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-navy-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-sm text-navy-400 mt-1">{hint}</span>}
    </label>
  )
}

const STATUS_STYLE: Record<BookingStatus, string> = {
  confirmed: 'bg-jungle-100 text-jungle-800',
  pending: 'bg-amber-100 text-amber-800',
  suggested: 'bg-sky-100 text-sky-800',
  needs_verification: 'bg-ember-100 text-ember-600',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-navy-100 text-navy-700',
}
export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cx('h-2.5 w-full rounded-full bg-navy-100 overflow-hidden', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-jungle-500 transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-navy-400"><Loader2 className="h-5 w-5 animate-spin" />{label}</div>
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-navy-100/60', className)} />
}
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4 text-navy-500">
      {icon && <div className="mx-auto mb-2 flex justify-center text-navy-300">{icon}</div>}
      <p className="font-semibold text-navy-700">{title}</p>
      {hint && <p className="text-base mt-1">{hint}</p>}
    </div>
  )
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-800 flex gap-3 items-start">
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
const TONES = ['bg-navy-600', 'bg-jungle-600', 'bg-ember-500', 'bg-sand-500', 'bg-navy-400']
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
  const tone = TONES[(profile?.id.charCodeAt(0) ?? 0) % TONES.length]
  const style = { width: size, height: size, fontSize: size * 0.4 }
  return url
    ? <img src={url} alt={name} style={style} className={cx('rounded-full object-cover ring-2 ring-white', className)} />
    : <span style={style} aria-label={name} className={cx('inline-flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white', tone, className)}>{name.slice(0, 1).toUpperCase()}</span>
}
