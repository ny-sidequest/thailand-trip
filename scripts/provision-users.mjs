// Creates the trip's accounts. Run LOCALLY; secrets come from your shell, never from the repo:
//   export SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...
//   cp scripts/users.example.json scripts/users.json   # edit names/usernames (gitignored)
//   npm run provision
// Random passwords are printed ONCE. Share each privately; users change them in Profile.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell.'); process.exit(1) }
let cfg
try { cfg = JSON.parse(readFileSync(new URL('./users.json', import.meta.url), 'utf8')) }
catch { console.error('Create scripts/users.json from scripts/users.example.json first.'); process.exit(1) }

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: trip, error: te } = await sb.from('trips').select('id').eq('slug', cfg.trip_slug).single()
if (te) { console.error('Trip not found. Run supabase/seed.sql first.', te.message); process.exit(1) }

const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const genPw = () => Array.from(randomBytes(16), (b) => alphabet[b % alphabet.length]).join('')

const rows = []
for (const u of cfg.users) {
  const username = u.username.toLowerCase()
  const exists = await sb.from('profiles').select('id').eq('username', username).maybeSingle()
  if (exists.data) { rows.push({ username, status: 'already exists (skipped)', password: '-' }); continue }
  const password = genPw()
  const { data, error } = await sb.auth.admin.createUser({
    email: u.email || `${username}@thailand-trip.example.com`, password, email_confirm: true })
  if (error) { rows.push({ username, status: `ERROR ${error.message}`, password: '-' }); continue }
  const p = await sb.from('profiles').insert({ id: data.user.id, username, display_name: u.display_name })
  const m = p.error ? p : await sb.from('trip_members').insert({ trip_id: trip.id, user_id: data.user.id, role: u.role === 'admin' ? 'admin' : 'member' })
  if (m.error) { await sb.auth.admin.deleteUser(data.user.id); rows.push({ username, status: `ERROR ${m.error.message}`, password: '-' }); continue }
  rows.push({ username, role: u.role, status: 'created', password })
}
console.table(rows)
console.log('Passwords are shown once. Store them in a password manager and share privately.')
