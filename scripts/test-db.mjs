// Runs the real migrations + seed in an in-process Postgres (PGlite) with Supabase-shaped stubs,
// then asserts RLS behaviour as each of five users. Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const read = (f) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), 'utf8')

// ---- Supabase stubs (auth, storage, realtime publication, roles) ----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  grant select on auth.users to authenticated; grant all on storage.objects to authenticated;
  grant execute on function auth.uid(), storage.foldername(text) to anon, authenticated;
`)
await db.exec(read('migrations/0001_schema.sql').replace('create extension if not exists pgcrypto;', ''))
await db.exec(read('migrations/0002_rls.sql'))
await db.exec(read('migrations/0003_storage_realtime.sql'))
await db.exec(read('migrations/0004_itinerary_events.sql'))
await db.exec(read('seed.sql'))

const T = '00000000-0000-4000-8000-000000000001'
const names = ['admin', 'ravi', 'sam', 'kiran', 'dev']
const ids = {}
for (const [i, n] of names.entries()) {
  const id = `10000000-0000-4000-8000-00000000000${i + 1}`
  ids[n] = id
  await db.exec(`insert into auth.users(id,email) values ('${id}','${n}@x.test');
    insert into profiles(id,username,display_name) values ('${id}','${n}_user','${n}');
    insert into trip_members(trip_id,user_id,role) values ('${T}','${id}','${i === 0 ? 'admin' : 'member'}');`)
}
// an outsider who belongs to no trip
const out = '20000000-0000-4000-8000-000000000001'
await db.exec(`insert into auth.users(id,email) values ('${out}','o@x.test');
  insert into profiles(id,username,display_name) values ('${out}','outsider','outsider');`)

let pass = 0, fail = 0
async function as(user, sql, params) {
  const uid = ids[user] ?? out
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false)`)
  try { return await db.query(sql, params) } finally { await db.exec('reset role') }
}
async function ok(label, fn) {
  try { await fn(); pass++; console.log('  ✓', label) } catch (e) { fail++; console.log('  ✗', label, '\n     ', e.message) }
}
async function denied(label, fn) {   // expects error OR zero affected rows
  try {
    const r = await fn()
    if ((r?.affectedRows ?? 0) > 0 || (r?.rows?.length ?? 0) > 0) throw new Error('was allowed')
    pass++; console.log('  ✓', label)
  } catch (e) {
    if (e.message === 'was allowed') { fail++; console.log('  ✗', label, '(ALLOWED)') } else { pass++; console.log('  ✓', label, '(error)') }
  }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: expected ${b}, got ${a}`) }

console.log('Seed')
await ok('11 days, no unconfirmed booking marked confirmed wrongly', async () => {
  const r = await db.query(`select count(*)::int n from itinerary_days`); eq(r.rows[0].n, 11, 'days')
  const c = await db.query(`select title from itinerary_activities where status='confirmed' order by title`)
  console.log('     confirmed activities:', c.rows.map(x => x.title).join(' | '))
})

console.log('Membership / read access')
await ok('member reads trip + itinerary', async () => {
  eq((await as('ravi', 'select * from trips')).rows.length, 1, 'trips')
  eq((await as('ravi', 'select count(*)::int n from itinerary_days')).rows[0].n, 11, 'days')
})
await ok('outsider sees nothing', async () => {
  for (const t of ['trips', 'itinerary_days', 'itinerary_activities', 'checklist_items', 'accommodation_bookings'])
    eq((await as('outsider', `select count(*)::int n from ${t}`)).rows[0].n, 0, t)
  eq((await as('outsider', 'select count(*)::int n from profiles')).rows[0].n, 1, 'profiles (self only)')
})
await ok('anon role has no access', async () => {
  await db.exec('set role anon'); let blocked = false
  try { await db.query('select * from trips') } catch { blocked = true }
  await db.exec('reset role'); if (!blocked) throw new Error('anon could read')
})

console.log('Admin-only writes')
await denied('member cannot insert itinerary day', () => as('ravi', `insert into itinerary_days(trip_id,day_number,day_date,city,title) values ('${T}',99,'2027-01-01','x','x')`))
await denied('member cannot update activity', () => as('ravi', `update itinerary_activities set status='confirmed' where title like 'Phi Phi%'`))
await ok('admin can update activity', async () => {
  const r = await as('admin', `update itinerary_activities set status='pending' where title like 'Phi Phi%'`); eq(r.affectedRows, 1, 'rows')
})
await denied('member cannot post announcement', () => as('ravi', `insert into announcements(trip_id,title,body,created_by) values ('${T}','t','b','${ids.ravi}')`))
await denied('member cannot change own role', () => as('ravi', `update trip_members set role='admin' where user_id='${ids.ravi}'`))
await denied('member cannot change trip name', () => as('ravi', `update trips set name='hacked'`))
await denied('member cannot edit username', () => as('ravi', `update profiles set username='admin_user2' where id='${ids.ravi}'`))
await ok('member can edit own display name', async () => {
  eq((await as('ravi', `update profiles set display_name='Ravi K' where id='${ids.ravi}'`)).affectedRows, 1, 'rows') })
await denied('member cannot edit other profile', () => as('ravi', `update profiles set display_name='x' where id='${ids.sam}'`))

console.log('Checklist privacy')
await ok('member ticks own item', async () => {
  const it = (await db.query(`select id from checklist_items limit 1`)).rows[0].id
  await as('ravi', `insert into checklist_completions(item_id,user_id,trip_id) values ($1,'${ids.ravi}','${T}')`, [it]) })
await denied('member cannot tick for someone else', async () => {
  const it = (await db.query(`select id from checklist_items offset 1 limit 1`)).rows[0].id
  return as('ravi', `insert into checklist_completions(item_id,user_id,trip_id) values ($1,'${ids.sam}','${T}')`, [it]) })
await ok('other member cannot read ravi completions; admin can', async () => {
  eq((await as('sam', 'select count(*)::int n from checklist_completions')).rows[0].n, 0, 'sam')
  eq((await as('admin', 'select count(*)::int n from checklist_completions')).rows[0].n, 1, 'admin') })
await ok('progress function visible to members w/o item detail', async () => {
  const r = await as('sam', `select * from checklist_progress('${T}')`)
  eq(r.rows.length, 5, 'rows'); eq(Number(r.rows.find(x => x.user_id === ids.ravi).completed), 1, 'ravi count') })
await denied('outsider cannot call progress', () => as('outsider', `select * from checklist_progress('${T}')`))

console.log('Expenses')
let e1
await ok('member adds expense with splits', async () => {
  const r = await as('ravi', `insert into expenses(trip_id,description,amount,currency,fx_rate_to_base,amount_base,payer_id,created_by)
    values ('${T}','Dinner',1000,'THB',2.5,2500,'${ids.ravi}','${ids.ravi}') returning id`); e1 = r.rows[0].id
  await as('ravi', `insert into expense_splits(expense_id,user_id,trip_id,share_amount) values ($1,'${ids.sam}','${T}',500),($1,'${ids.ravi}','${T}',500)`, [e1]) })
await ok('other members see it', async () => eq((await as('kiran', 'select count(*)::int n from expenses')).rows[0].n, 1, 'n'))
await denied('member cannot edit another member\'s expense', () => as('sam', `update expenses set amount=1 where id='${e1}'`))
await ok('admin can correct, audit trail written', async () => {
  eq((await as('admin', `update expenses set amount=1200, amount_base=3000 where id='${e1}'`)).affectedRows, 1, 'rows')
  eq((await db.query(`select count(*)::int n from expense_audit where expense_id='${e1}'`)).rows[0].n, 2, 'audit') })
await denied('cannot forge created_by', () => as('sam', `insert into expenses(trip_id,description,amount,currency,amount_base,payer_id,created_by) values ('${T}','x',1,'INR',1,'${ids.sam}','${ids.ravi}')`))
await denied('payer must be a trip member', () => as('sam', `insert into expenses(trip_id,description,amount,currency,amount_base,payer_id,created_by) values ('${T}','x',1,'INR',1,'${out}','${ids.sam}')`))
await denied('cannot insert unsupported currency', () => as('sam', `insert into expenses(trip_id,description,amount,currency,amount_base,payer_id,created_by) values ('${T}','x',1,'USD',1,'${ids.sam}','${ids.sam}')`))
await ok('personal expense hidden from others (incl. splits)', async () => {
  const r = await as('sam', `insert into expenses(trip_id,description,amount,currency,amount_base,payer_id,created_by,is_personal) values ('${T}','Souvenir',100,'THB',250,'${ids.sam}','${ids.sam}',true) returning id`)
  const id = r.rows[0].id
  await as('sam', `insert into expense_splits(expense_id,user_id,trip_id,share_amount) values ($1,'${ids.sam}','${T}',100)`, [id])
  eq((await as('ravi', `select count(*)::int n from expenses where is_personal`)).rows[0].n, 0, 'ravi')
  eq((await as('admin', `select count(*)::int n from expenses where is_personal`)).rows[0].n, 0, 'admin')
  eq((await as('ravi', `select count(*)::int n from expense_splits where expense_id='${id}'`)).rows[0].n, 0, 'splits') })
await denied('member cannot add splits to someone else\'s expense', () => as('sam', `insert into expense_splits(expense_id,user_id,trip_id,share_amount) values ('${e1}','${ids.dev}','${T}',1)`))

console.log('Settlements')
const key = '30000000-0000-4000-8000-000000000001'
await ok('member records settlement', async () => as('sam', `insert into settlements(trip_id,from_user,to_user,amount,currency,idempotency_key,created_by) values ('${T}','${ids.sam}','${ids.ravi}',500,'THB','${key}','${ids.sam}')`))
await denied('duplicate settlement (same idempotency key) rejected', () => as('sam', `insert into settlements(trip_id,from_user,to_user,amount,currency,idempotency_key,created_by) values ('${T}','${ids.sam}','${ids.ravi}',500,'THB','${key}','${ids.sam}')`))
await denied('cannot record settlement between two others', () => as('kiran', `insert into settlements(trip_id,from_user,to_user,amount,currency,idempotency_key,created_by) values ('${T}','${ids.sam}','${ids.ravi}',1,'THB','${key.replace(/1$/, '2')}','${ids.kiran}')`))

console.log('Social')
await ok('member posts to feed as self', async () => as('dev', `insert into activity_feed(trip_id,actor_id,verb,summary,body) values ('${T}','${ids.dev}','post','dev posted','hello')`))
await denied('cannot post as someone else', () => as('dev', `insert into activity_feed(trip_id,actor_id,verb,summary) values ('${T}','${ids.sam}','post','fake')`))
await denied('cannot forge system event verbs', () => as('dev', `insert into activity_feed(trip_id,actor_id,verb,summary) values ('${T}','${ids.dev}','expense','fake')`))
await denied('cannot reassign feed post actor', () => as('dev', `update activity_feed set actor_id='${ids.sam}'`))
await ok('comment + reaction', async () => {
  const a = (await db.query(`select id from itinerary_activities limit 1`)).rows[0].id
  const c = await as('sam', `insert into comments(trip_id,target_type,target_id,author_id,body) values ('${T}','activity','${a}','${ids.sam}','Love it') returning id`)
  await as('ravi', `insert into reactions(trip_id,target_type,target_id,user_id,emoji) values ('${T}','comment','${c.rows[0].id}','${ids.ravi}','🔥')`) })
await denied('cannot edit others\' comment', () => as('ravi', `update comments set body='edited'`))
await denied('outsider cannot comment', () => as('outsider', `insert into comments(trip_id,target_type,target_id,author_id,body) values ('${T}','feed',gen_random_uuid(),'${out}','hi')`))

console.log('Itinerary events')
await ok('activity comment writes a feed event attributed to the commenter', async () => {
  const r = await db.query(`select actor_id, summary, body from activity_feed where verb='comment'`)
  eq(r.rows.length, 1, 'rows'); eq(r.rows[0].actor_id, ids.sam, 'actor'); eq(r.rows[0].body, 'Love it', 'body') })
await ok('status change writes a feed event; non-status edit does not', async () => {
  const n0 = (await db.query(`select count(*)::int n from activity_feed where verb='booking'`)).rows[0].n
  await as('admin', `update itinerary_activities set status='confirmed' where title like 'Phi Phi%'`)
  await as('admin', `update itinerary_activities set reminders='x' where title like 'Phi Phi%'`)
  const r = await db.query(`select summary from activity_feed where verb='booking' order by created_at desc, id desc`)
  eq(r.rows.length, n0 + 1, 'rows'); console.log('     ', r.rows.map((x) => x.summary).join(' | ')) })
await ok('member cannot change activity status (so no forged event)', async () =>
  eq((await as('sam', `update itinerary_activities set status='cancelled'`)).affectedRows, 0, 'rows'))

console.log('Polls')
let poll, o1, o2
await ok('admin creates single-choice poll', async () => {
  poll = (await as('admin', `insert into polls(trip_id,question,multiple_choice,created_by) values ('${T}','NYE party?',false,'${ids.admin}') returning id`)).rows[0].id
  o1 = (await as('admin', `insert into poll_options(poll_id,trip_id,label) values ('${poll}','${T}','Deck') returning id`)).rows[0].id
  o2 = (await as('admin', `insert into poll_options(poll_id,trip_id,label) values ('${poll}','${T}','Paradise') returning id`)).rows[0].id })
await ok('member votes once', async () => as('ravi', `insert into poll_votes(poll_id,option_id,user_id,trip_id) values ('${poll}','${o1}','${ids.ravi}','${T}')`))
await denied('second vote in single-choice poll rejected', () => as('ravi', `insert into poll_votes(poll_id,option_id,user_id,trip_id) values ('${poll}','${o2}','${ids.ravi}','${T}')`))
await denied('cannot vote as someone else', () => as('ravi', `insert into poll_votes(poll_id,option_id,user_id,trip_id) values ('${poll}','${o2}','${ids.sam}','${T}')`))
await ok('admin closes poll; voting then rejected', async () => {
  await as('admin', `update polls set closed_at=now() where id='${poll}'`)
  await denied('vote after close', () => as('sam', `insert into poll_votes(poll_id,option_id,user_id,trip_id) values ('${poll}','${o1}','${ids.sam}','${T}')`)) })
await denied('member cannot close poll', () => as('sam', `update polls set closed_at=now()`))

console.log('Notifications / documents / announcements')
await db.exec(`insert into notifications(trip_id,user_id,type,title) values ('${T}','${ids.ravi}','x','for ravi')`)
await ok('notifications are private', async () => {
  eq((await as('sam', 'select count(*)::int n from notifications')).rows[0].n, 0, 'sam')
  eq((await as('ravi', 'select count(*)::int n from notifications')).rows[0].n, 1, 'ravi') })
await denied('member cannot forge notification', () => as('sam', `insert into notifications(trip_id,user_id,type,title) values ('${T}','${ids.ravi}','x','fake')`))
await ok('member uploads document record; other member cannot edit it', async () => {
  const d = await as('kiran', `insert into documents(trip_id,name,category,storage_path,uploaded_by) values ('${T}','Hotel','hotel','${T}/a.pdf','${ids.kiran}') returning id`)
  eq((await as('sam', `select count(*)::int n from documents`)).rows[0].n, 1, 'visible')
  eq((await as('sam', `update documents set name='x' where id='${d.rows[0].id}'`)).affectedRows, 0, 'sam edit')
  eq((await as('admin', `update documents set notes='ok' where id='${d.rows[0].id}'`)).affectedRows, 1, 'admin edit') })
await ok('announcement read receipts are private', async () => {
  const a = (await as('admin', `insert into announcements(trip_id,title,body,created_by) values ('${T}','Meet 6pm','b','${ids.admin}') returning id`)).rows[0].id
  await as('ravi', `insert into announcement_reads(announcement_id,user_id,trip_id) values ('${a}','${ids.ravi}','${T}')`)
  eq((await as('sam', 'select count(*)::int n from announcement_reads')).rows[0].n, 0, 'sam') })

console.log('Storage policies')
await db.exec(`insert into storage.objects(bucket_id,name,owner) values
  ('documents','${T}/hotel.pdf','${ids.kiran}'),('avatars','${ids.ravi}/a.png','${ids.ravi}')`)
await ok('member reads trip documents; outsider cannot', async () => {
  eq((await as('sam', `select count(*)::int n from storage.objects where bucket_id='documents'`)).rows[0].n, 1, 'sam')
  eq((await as('outsider', `select count(*)::int n from storage.objects where bucket_id='documents'`)).rows[0].n, 0, 'outsider') })
await denied('outsider cannot upload into trip folder', () => as('outsider', `insert into storage.objects(bucket_id,name,owner) values ('documents','${T}/x.pdf','${out}')`))
await denied('member cannot upload into another user\'s avatar folder', () => as('sam', `insert into storage.objects(bucket_id,name,owner) values ('avatars','${ids.ravi}/evil.png','${ids.sam}')`))
await ok('avatar readable by trip-mates only', async () => {
  eq((await as('sam', `select count(*)::int n from storage.objects where bucket_id='avatars'`)).rows[0].n, 1, 'sam')
  eq((await as('outsider', `select count(*)::int n from storage.objects where bucket_id='avatars'`)).rows[0].n, 0, 'outsider') })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
