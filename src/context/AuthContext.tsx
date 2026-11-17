import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, usernameLogin } from '@/lib/supabase'
import { clearAllCaches } from '@/lib/offlineCache'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}
const Ctx = createContext<AuthState | null>(null)
export const useAuth = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) return setProfile(null)
    const { data } = await supabase.from('profiles')
      .select('id,username,display_name,avatar_path,phone,emergency_contact').eq('id', uid).maybeSingle()
    setProfile(data as Profile | null)
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      // defer: never await supabase calls inside the auth callback
      setTimeout(() => void loadProfile(s?.user.id), 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const signIn = useCallback(async (username: string, password: string) => {
    const t = await usernameLogin(username.trim().toLowerCase(), password)
    const { error } = await supabase.auth.setSession(t)
    if (error) throw new Error(error.message)
  }, [])
  const signOut = useCallback(async () => { clearAllCaches(); await supabase.auth.signOut() }, [])
  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session])

  const value = useMemo(() => ({ session, profile, loading, signIn, signOut, refreshProfile }),
    [session, profile, loading, signIn, signOut, refreshProfile])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
