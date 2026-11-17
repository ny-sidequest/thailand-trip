// One-off hardening: replace predictable sign-in emails (<username>@thailand-trip.example.com) with random ones.
// Users still sign in with their username and password; nothing changes for them. Run in your own terminal:
//   export SUPABASE_URL=...   read -s "SUPABASE_SERVICE_ROLE_KEY?key: " && export SUPABASE_SERVICE_ROLE_KEY
//   node scripts/rotate-emails.mjs
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell.'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })
const { data: profiles, error } = await sb.from('profiles').select('id,username')
if (error) { console.error(error.message); process.exit(1) }
const rows = []
for (const p of profiles) {
  const { data } = await sb.auth.admin.getUserById(p.id)
  const email = data?.user?.email ?? ''
  if (email !== `${p.username}@thailand-trip.example.com`) { rows.push({ username: p.username, status: 'skipped (already random or custom email)' }); continue }
  const { error: e } = await sb.auth.admin.updateUserById(p.id, { email: `u-${randomUUID()}@thailand-trip.example.com`, email_confirm: true })
  rows.push({ username: p.username, status: e ? `ERROR ${e.message}` : 'rotated' })
}
console.table(rows)
