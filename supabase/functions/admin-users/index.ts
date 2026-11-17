// Admin-only account management. The caller's JWT is verified, then their ADMIN role in
// trip_members is checked with the service role. Deploy: supabase functions deploy admin-users
import { createClient } from 'jsr:@supabase/supabase-js@2'

const origin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function genPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /i, '')
  const { data: caller } = await admin.auth.getUser(token)
  if (!caller?.user) return json({ error: 'Unauthorised' }, 401)

  let b: Record<string, string>
  try { b = await req.json() } catch { return json({ error: 'Bad request' }, 400) }
  const tripId = b.trip_id
  if (!/^[0-9a-f-]{36}$/.test(tripId ?? '')) return json({ error: 'trip_id required' }, 400)

  const { data: m } = await admin.from('trip_members').select('role')
    .eq('trip_id', tripId).eq('user_id', caller.user.id).maybeSingle()
  if (m?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

  const targetIsMember = async (uid: string) =>
    !!(await admin.from('trip_members').select('user_id').eq('trip_id', tripId).eq('user_id', uid).maybeSingle()).data

  switch (b.action) {
    case 'create': {
      const username = (b.username ?? '').trim().toLowerCase()
      const display = (b.display_name ?? '').trim()
      const role = b.role === 'admin' ? 'admin' : 'member'
      if (!/^[a-z0-9_.]{3,30}$/.test(username) || !display || display.length > 60) return json({ error: 'Invalid username or display name' }, 400)
      const password = b.password || genPassword()
      if (password.length < 10) return json({ error: 'Password must be at least 10 characters' }, 400)
      // random local part: the sign-in email is not derivable from the username
      const email = b.email || `u-${crypto.randomUUID()}@thailand-trip.example.com`
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error || !data.user) return json({ error: error?.message ?? 'Could not create user' }, 400)
      const uid = data.user.id
      const p = await admin.from('profiles').insert({ id: uid, username, display_name: display })
      const tm = p.error ? p : await admin.from('trip_members').insert({ trip_id: tripId, user_id: uid, role })
      if (tm.error) { await admin.auth.admin.deleteUser(uid); return json({ error: tm.error.message }, 400) }
      return json({ user_id: uid, username, temporary_password: password })
    }
    case 'reset_password': {
      if (!(await targetIsMember(b.user_id))) return json({ error: 'Not a member of this trip' }, 404)
      const password = b.password || genPassword()
      if (password.length < 10) return json({ error: 'Password must be at least 10 characters' }, 400)
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ user_id: b.user_id, temporary_password: password })
    }
    case 'set_role': {
      if (!(await targetIsMember(b.user_id))) return json({ error: 'Not a member of this trip' }, 404)
      const role = b.role === 'admin' ? 'admin' : 'member'
      if (b.user_id === caller.user.id && role !== 'admin') return json({ error: 'You cannot demote yourself' }, 400)
      const { error } = await admin.from('trip_members').update({ role }).eq('trip_id', tripId).eq('user_id', b.user_id)
      return error ? json({ error: error.message }, 400) : json({ ok: true })
    }
    case 'remove_member': {
      if (b.user_id === caller.user.id) return json({ error: 'You cannot remove yourself' }, 400)
      const { error } = await admin.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', b.user_id)
      return error ? json({ error: error.message }, 400) : json({ ok: true })
    }
    default:
      return json({ error: 'Unknown action' }, 400)
  }
})
