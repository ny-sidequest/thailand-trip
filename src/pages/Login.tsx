import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Field, inputCls } from '@/components/ui'
import CityScene from '@/components/CityScene'

export default function Login() {
  const { session, loading, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!loading && session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    try { await signIn(username, password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed') } finally { setBusy(false) }
  }

  return (
    <div className="relative min-h-screen overflow-hidden grid lg:grid-cols-[1.1fr_1fr]">
      {/* Scene: dusk over Bangkok, glass tagline */}
      <div className="relative hidden lg:block bg-navy-900">
        <CityScene city="Bangkok" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/20 to-navy-900/50" />
        <div className="absolute -top-24 -right-16 h-96 w-96 rounded-full bg-ember-500/40 blur-3xl animate-float" />
        <div className="relative h-full flex flex-col justify-end p-14 text-white">
          <p className="eyebrow !text-sand-200">Bangkok · Phuket · Krabi</p>
          <h1 className="font-display text-5xl font-semibold tracking-[-0.03em] mt-3 leading-[1.06]">Trip HQ</h1>
          <p className="mt-3 text-white/80 text-lg max-w-sm">Everything for the trip, in one private place.</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-5">
        <div className="lg:hidden absolute inset-x-0 top-0 h-60 overflow-hidden" aria-hidden="true">
          <CityScene city="Bangkok" className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy-900/10 via-transparent to-[#efe9de]" />
        </div>
        <form onSubmit={submit} className="glass-strong relative w-full max-w-sm rounded-[28px] p-6 sm:p-8 space-y-5 animate-rise mt-24 lg:mt-0">
          <div className="text-center">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="mx-auto h-14 w-14 rounded-2xl shadow-glass" />
            <h2 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold tracking-tight text-navy-800 mt-3">Welcome back</h2>
            <p className="text-navy-500 mt-1">Sign in to your trip</p>
          </div>
          <Field label="Username">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-400" aria-hidden="true" />
              <input className={`${inputCls} pl-11`} autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-400" aria-hidden="true" />
              <input className={`${inputCls} pl-11 pr-12`} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-navy-400">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          {error && <p role="alert" className="rounded-2xl bg-red-50/90 border border-red-200 px-4 py-3 text-red-800">{error}</p>}
          <Button type="submit" busy={busy} className="w-full min-h-[50px]" variant="accent">Sign in</Button>
          <p className="text-center text-sm text-navy-500">Accounts are created by the trip admin.</p>
        </form>
      </div>
    </div>
  )
}
