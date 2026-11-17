import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(SUPABASE_URL && ANON)

// Only the public anon key lives in the browser. All access control is enforced by RLS.
export const supabase = createClient(SUPABASE_URL ?? 'http://localhost:54321', ANON ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
})

/** Throw on Supabase error so callers can use try/catch or useAsync. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export async function usernameLogin(username: string, password: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/username-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ username, password }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error ?? 'Sign-in failed')
  return body as { access_token: string; refresh_token: string }
}

export async function callAdminUsers(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}
