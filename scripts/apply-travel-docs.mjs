// Loads the real trip documents + the facts extracted from them into the live app.
// It signs in as YOU (admin) with your own username/password, so it only does what the app itself would allow:
// no service-role key, nothing stored. Private data lives only in the git-ignored travel_docs/ folder.
//
//   node scripts/apply-travel-docs.mjs --check                 offline: validate the manifest and files
//   node scripts/apply-travel-docs.mjs --dry-run               sign in, read, report what WOULD change (writes nothing)
//   node scripts/apply-travel-docs.mjs                          apply (asks you to type YES first)
//   options:  --tick evidenced|all|none   which "Travel documents" checklist items to tick for YOU (default: evidenced)
//
// Safe to re-run: documents/checklist items that already exist are skipped, patches are idempotent.
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { basename, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'travel_docs')
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const CHECK = flag('--check'), DRY = flag('--dry-run'), TICK = opt('--tick', 'evidenced')
if (!['evidenced', 'all', 'none'].includes(TICK)) { console.error('--tick must be evidenced, all or none'); process.exit(1) }

// ---------------------------------------------------------------- manifest + offline validation
const manifestPath = join(DIR, '_manifest.json')
if (!existsSync(manifestPath)) { console.error('Missing travel_docs/_manifest.json'); process.exit(1) }
const M = JSON.parse(readFileSync(manifestPath, 'utf8'))

const STATUS = ['confirmed', 'pending', 'suggested', 'needs_verification', 'cancelled', 'completed']
const CATS = ['flight', 'hotel', 'hostel', 'bus', 'ferry', 'activity', 'insurance', 'entry', 'emergency', 'misc']
const ISO = /^\d{4}-\d{2}-\d{2}$/
const safeUrl = (u) => !u || /^https?:\/\//i.test(u)
function validate() {
  const errs = []
  const bad = (m) => errs.push(m)
  for (const a of M.accommodation ?? []) {
    if (!ISO.test(a.match?.check_in ?? '')) bad(`stay match needs check_in: ${JSON.stringify(a.match)}`)
    if (a.patch.status && !STATUS.includes(a.patch.status)) bad(`bad status ${a.patch.status}`)
    if (!safeUrl(a.patch.maps_url)) bad(`unsafe maps_url in ${a.patch.name}`)
  }
  for (const t of M.transport ?? []) { if (!t.match?.mode) bad('flight match needs mode'); if (!safeUrl(t.patch.maps_url)) bad('unsafe maps_url') }
  for (const u of M.activities?.updates ?? []) if (!u.day || !u.title_like) bad(`activity update needs day + title_like: ${JSON.stringify(u).slice(0, 80)}`)
  for (const d of M.documents ?? []) {
    const f = join(DIR, d.file)
    if (!existsSync(f)) { bad(`missing file ${d.file}`); continue }
    const size = statSync(f).size
    if (size === 0 || size > 20 * 1024 * 1024) bad(`${d.file}: size ${size} out of range`)
    if (!d.file.toLowerCase().endsWith('.pdf')) bad(`${d.file}: only PDFs are configured`)
    if (!CATS.includes(d.category)) bad(`${d.name}: bad category ${d.category}`)
    if (d.related_date && !ISO.test(d.related_date)) bad(`${d.name}: bad related_date`)
    if (!d.name || d.name.length > 160) bad(`bad document name: ${d.name}`)
  }
  const names = (M.documents ?? []).map((d) => d.name)
  if (new Set(names).size !== names.length) bad('duplicate document names')
  return errs
}
const problems = validate()
if (problems.length) { console.error('Manifest problems:\n - ' + problems.join('\n - ')); process.exit(1) }
console.log(`Manifest OK: ${M.accommodation.length} stays · ${M.transport.length} flights · ${M.activities.updates.length} activity updates + ${M.activities.inserts.length} new · ${M.checklist.add.length} checklist items · ${M.documents.length} documents`)
if (CHECK) process.exit(0)

// ---------------------------------------------------------------- helpers
function ask(prompt, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.stdoutMuted = false
    rl._writeToOutput = function (s) { if (this.stdoutMuted) { if (s.includes('\n')) this.output.write('\n') } else this.output.write(s) }
    rl.question(prompt, (a) => { rl.close(); resolve(a) })
    rl.stdoutMuted = hidden
  })
}
const safeFilename = (name) => {
  const e = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
  const base = (e ? name.slice(0, -(e.length + 1)) : name).normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^[_.]+|[_.]+$/g, '').slice(0, 60) || 'file'
  return e ? `${base}.${e.replace(/[^a-z0-9]/g, '').slice(0, 5)}` : base
}
const env = Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = env.VITE_SUPABASE_URL, ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !ANON) { console.error('.env needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'); process.exit(1) }

// ---------------------------------------------------------------- sign in as the admin (nothing is stored)
const username = (await ask('Your username: ')).trim().toLowerCase()
const password = await ask('Your password (hidden): ', true)
const res = await fetch(`${URL_}/functions/v1/username-login`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ username, password }) })
const tokens = await res.json().catch(() => ({}))
if (!res.ok) { console.error('Sign-in failed:', tokens.error ?? res.status); process.exit(1) }
const sb = createClient(URL_, ANON, { auth: { persistSession: false } })
await sb.auth.setSession(tokens)
const { data: { user } } = await sb.auth.getUser()
const uid = user.id
const { data: trip } = await sb.from('trips').select('id,name').eq('slug', M.trip_slug).single()
const { data: mem } = await sb.from('trip_members').select('role').eq('trip_id', trip.id).eq('user_id', uid).single()
if (mem?.role !== 'admin') { console.error('This script must be run by a trip admin.'); process.exit(1) }
console.log(`\nSigned in as ${username} (admin) · trip: ${trip.name}${DRY ? '  ·  DRY RUN: nothing will be written' : ''}\n`)

if (!DRY) {
  const go = (await ask('Apply all changes to the live app? Type YES to continue: ')).trim()
  if (go !== 'YES') { console.log('Cancelled. Nothing was changed.'); process.exit(0) }
  console.log()
}

// ---------------------------------------------------------------- execution
let writes = 0, skipped = 0, failures = 0
const say = (sym, msg) => console.log(`  ${sym} ${msg}`)
const fail = (msg) => { failures++; say('✗', msg) }
async function matchOne(table, match, extra = {}) {
  let q = sb.from(table).select('id').eq('trip_id', trip.id).is('deleted_at', null)
  for (const [k, v] of Object.entries({ ...match, ...extra })) q = q.eq(k, v)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (data.length !== 1) throw new Error(`expected exactly 1 row, found ${data.length} for ${JSON.stringify(match)}`)
  return data[0].id
}
async function patch(table, id, values, label) {
  if (DRY) { say('·', `would update ${label}`); writes++; return }
  const { data, error } = await sb.from(table).update(values).eq('id', id).select('id')
  if (error || !data?.length) return fail(`${label}: ${error?.message ?? 'not permitted'}`)
  say('✓', `updated ${label}`); writes++
}

const linkIds = { accommodation: {}, transport: {} }
console.log('Stays')
for (const a of M.accommodation) {
  try { const id = await matchOne('accommodation_bookings', a.match); linkIds.accommodation[a.match.check_in] = id; await patch('accommodation_bookings', id, a.patch, a.patch.name) } catch (e) { fail(`${a.patch.name}: ${e.message}`) }
}
console.log('Flights')
for (const t of M.transport) {
  try { const id = await matchOne('transport_bookings', t.match); linkIds.transport[t.match.travel_date] = id; await patch('transport_bookings', id, t.patch, t.patch.operator) } catch (e) { fail(`${t.patch.operator}: ${e.message}`) }
}
console.log('Itinerary')
const dayIds = {}
async function dayId(n) { return (dayIds[n] ??= (await matchOne('itinerary_days', { day_number: n }))) }
for (const d of M.days ?? []) { try { await patch('itinerary_days', await dayId(d.day_number), d.patch, `day ${d.day_number} summary`) } catch (e) { fail(`day ${d.day_number}: ${e.message}`) } }
for (const u of M.activities.updates) {
  try {
    const { data, error } = await sb.from('itinerary_activities').select('id,title').eq('day_id', await dayId(u.day)).is('deleted_at', null).like('title', u.title_like)
    if (error) throw new Error(error.message)
    if (data.length !== 1) throw new Error(`"${u.title_like}" matched ${data.length} activities (the itinerary may have been edited)`)
    await patch('itinerary_activities', data[0].id, { ...u.patch, updated_by: uid }, `Day ${u.day}: ${data[0].title}`)
  } catch (e) { fail(`Day ${u.day} "${u.title_like}": ${e.message}`) }
}
for (const i of M.activities.inserts) {
  try {
    const did = await dayId(i.day)
    const { data: ex } = await sb.from('itinerary_activities').select('id').eq('day_id', did).eq('title', i.title).is('deleted_at', null)
    if (ex?.length) { say('–', `exists: ${i.title}`); skipped++; continue }
    if (DRY) { say('·', `would add Day ${i.day}: ${i.title}`); writes++; continue }
    const { error } = await sb.from('itinerary_activities').insert({ trip_id: trip.id, day_id: did, title: i.title, created_by: uid, ...i.fields })
    error ? fail(`${i.title}: ${error.message}`) : (say('✓', `added Day ${i.day}: ${i.title}`), writes++)
  } catch (e) { fail(`${i.title}: ${e.message}`) }
}

console.log('Checklist')
const { data: existing } = await sb.from('checklist_items').select('id,title,category,sort_order').eq('trip_id', trip.id).is('deleted_at', null)
let nextSort = Math.max(0, ...(existing ?? []).map((x) => x.sort_order)) + 1
for (const c of M.checklist.add) {
  if (existing?.some((x) => x.title === c.title)) { say('–', `exists: ${c.title}`); skipped++; continue }
  if (DRY) { say('·', `would add item: ${c.title}`); writes++; continue }
  const { error } = await sb.from('checklist_items').insert({ trip_id: trip.id, category: c.category, title: c.title, description: c.description, due_date: c.due_date, sort_order: nextSort++, created_by: uid })
  error ? fail(`${c.title}: ${error.message}`) : (say('✓', `added item: ${c.title}`), writes++)
}
if (TICK !== 'none') {
  const { data: items } = await sb.from('checklist_items').select('id,title,category').eq('trip_id', trip.id).is('deleted_at', null)
  const wanted = TICK === 'all' ? items.filter((i) => i.category === 'Travel documents' && !M.checklist.add.some((a) => a.title === i.title)) : items.filter((i) => M.checklist.evidenced.includes(i.title))
  console.log(`Ticking ${wanted.length} item(s) for ${username} only (each traveller ticks their own)`)
  for (const it of wanted) {
    if (DRY) { say('·', `would tick: ${it.title}`); writes++; continue }
    const { error } = await sb.from('checklist_completions').insert({ item_id: it.id, user_id: uid, trip_id: trip.id })
    if (error && error.code !== '23505') fail(`${it.title}: ${error.message}`)
    else { say(error ? '–' : '✓', `${error ? 'already ticked' : 'ticked'}: ${it.title}`); error ? skipped++ : writes++ }
  }
}

console.log('Documents (private storage, visible to the whole group)')
const { data: haveDocs } = await sb.from('documents').select('name').eq('trip_id', trip.id).is('deleted_at', null)
for (const d of M.documents) {
  if (haveDocs?.some((x) => x.name === d.name)) { say('–', `already in the wallet: ${d.name}`); skipped++; continue }
  if (DRY) { say('·', `would upload: ${d.name}  (${basename(d.file)})`); writes++; continue }
  const bytes = readFileSync(join(DIR, d.file))
  const id = crypto.randomUUID()
  const path = `${trip.id}/${id}/${safeFilename(d.file)}`
  const up = await sb.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (up.error) { fail(`${d.name}: upload failed: ${up.error.message}`); continue }
  const linked = d.link ? [d.link.type, linkIds[d.link.type]?.[d.link.match.check_in ?? d.link.match.travel_date]] : [null, null]
  const { error } = await sb.from('documents').insert({
    id, trip_id: trip.id, name: d.name, category: d.category, related_date: d.related_date ?? null,
    related_booking_type: linked[1] ? linked[0] : null, related_booking_id: linked[1] ?? null,
    storage_path: path, mime_type: 'application/pdf', size_bytes: bytes.length, notes: d.notes ?? null,
    version: 1, uploaded_by: uid, visibility: 'group',
  })
  if (error) { await sb.storage.from('documents').remove([path]); fail(`${d.name}: ${error.message}`) } else { say('✓', `uploaded: ${d.name}`); writes++ }
}

console.log(`\n${DRY ? 'Dry run' : 'Done'}: ${writes} ${DRY ? 'change(s) planned' : 'change(s) made'}, ${skipped} already in place, ${failures} problem(s).`)
if (DRY) console.log('Nothing was written. Run again without --dry-run to apply.')
if (failures) { console.log('Some steps failed (see ✗ above). It is safe to fix and re-run.'); process.exit(1) }
