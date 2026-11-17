import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Field, inputCls } from '@/components/ui'

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-sand-100">
      <div className="relative hidden lg:flex flex-col justify-end bg-navy-800 p-12 text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-ember-500/80 blur-3xl opacity-40" />
        <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-jungle-800/70 to-transparent" />
        <div className="relative">
          <p className="text-sand-300 font-semibold tracking-widest text-sm uppercase">Bangkok · Phuket · Krabi</p>
          <h1 className="font-display text-5xl font-bold mt-3 leading-tight">Trip HQ</h1>
          <p className="mt-3 text-navy-100 text-lg max-w-sm">Everything for the trip, in one private place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5 animate-rise">
          <div className="lg:hidden text-center mb-2">
            <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-card" />
            <h1 className="font-display text-3xl font-bold text-navy-800 mt-3">Trip HQ</h1>
          </div>
          <div className="hidden lg:block"><h2 className="font-display text-3xl font-bold text-navy-800">Welcome back</h2></div>
          <Field label="Username">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-300" />
              <input className={`${inputCls} pl-11`} autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-navy-300" />
              <input className={`${inputCls} pl-11 pr-12`} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-navy-400">
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          {error && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-800">{error}</p>}
          <Button type="submit" busy={busy} className="w-full">Sign in</Button>
          <p className="text-center text-sm text-navy-400">Accounts are created by the trip admin.</p>
        </form>
      </div>
    </div>
  )
}
