// Username → session. Runs server-side so real/synthetic emails never reach the browser.
// Deploy with: supabase functions deploy username-login --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2'

const origin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const GENERIC = { error: 'Invalid username or password' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { username?: string; password?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const username = String(body.username ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!/^[a-z0-9_.]{3,30}$/.test(username) || password.length < 1 || password.length > 200) return json(GENERIC, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('id').eq('username', username).maybeSingle()
  if (!profile) return json(GENERIC, 401)
  const { data: u } = await admin.auth.admin.getUserById(profile.id)
  if (!u?.user?.email) return json(GENERIC, 401)

  const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email: u.user.email, password })
  if (error || !data.session) return json(GENERIC, 401)
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
