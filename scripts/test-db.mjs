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
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
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
await db.exec(read('migrations/0005_notifications_checklist.sql'))
await db.exec(read('migrations/0006_wallet.sql'))
await db.exec(read('migrations/0007_expenses.sql'))
await db.exec(read('migrations/0008_social.sql'))
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
    if (e.message === 'was allowed') { fail++; console.log('  ✗', label, '(ALLOWED)') } else { pass++; console.log('  ✓', label, process.env.SHOW_ERRORS ? '→ ' + e.message.slice(0, 90) : '(error)') }
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
const split = (pairs) => pairs.map(([u, share]) => ({ user_id: ids[u], share_amount: share }))
const exp = (over = {}) => ({ description: 'Dinner', category: 'food', amount: 1000, currency: 'THB', fx_rate: 2.5, expense_date: '2027-01-02',
  payer_id: ids.ravi, split_type: 'equal', is_personal: false, splits: split([['ravi', 500], ['sam', 500]]), ...over })
const save = (user, payload, id = null) => as(user, `select save_expense('${T}', $1, $2::jsonb) as id`, [id, JSON.stringify(payload)])
let e1
await ok('member adds expense via save_expense; stores rate + converted amount + splits', async () => {
  e1 = (await save('ravi', exp())).rows[0].id
  const r = (await db.query(`select amount_base, fx_rate_to_base, created_by, splits_snapshot is not null as snap from expenses where id='${e1}'`)).rows[0]
  eq(Number(r.amount_base), 2500, 'amount_base'); eq(Number(r.fx_rate_to_base), 2.5, 'rate'); eq(r.created_by, ids.ravi, 'creator'); eq(r.snap, true, 'snapshot')
  eq((await db.query(`select count(*)::int n from expense_splits where expense_id='${e1}'`)).rows[0].n, 2, 'splits') })
await ok('base-currency expense forces rate 1', async () => {
  const id = (await save('ravi', exp({ currency: 'INR', fx_rate: 99, amount: 300, splits: split([['ravi', 150], ['sam', 150]]) }))).rows[0].id
  eq(Number((await db.query(`select fx_rate_to_base r from expenses where id='${id}'`)).rows[0].r), 1, 'rate') })
await ok('other members see it; share holders were notified, not the payer', async () => {
  eq((await as('kiran', `select count(*)::int n from expenses where id='${e1}'`)).rows[0].n, 1, 'visible')
  const n = await db.query(`select user_id from notifications where type='expense' and title like '%Dinner%' and body like 'Your share: THB 500.00'`)
  eq(n.rows.length, 1, 'notified'); eq(n.rows[0].user_id, ids.sam, 'recipient') })
await denied('direct INSERT into expenses is blocked (must use save_expense)', () => as('ravi', `insert into expenses(trip_id,description,amount,currency,amount_base,payer_id,created_by) values ('${T}','x',1,'INR',1,'${ids.ravi}','${ids.ravi}')`))
await denied('direct UPDATE of an expense is blocked', () => as('ravi', `update expenses set amount=1 where id='${e1}'`))
await denied('direct INSERT into expense_splits is blocked', () => as('ravi', `insert into expense_splits(expense_id,user_id,trip_id,share_amount) values ('${e1}','${ids.dev}','${T}',1)`))
await denied('shares that do not add up are rejected', () => save('ravi', exp({ splits: split([['ravi', 500], ['sam', 499.99]]) })))
await denied('equal split with uneven shares is rejected', () => save('ravi', exp({ splits: split([['ravi', 900], ['sam', 100]]) })))
await ok('custom split accepts uneven shares that add up', async () => save('ravi', exp({ split_type: 'custom', splits: split([['ravi', 900], ['sam', 100]]) })))
await denied('percentage split must total 100', () => save('ravi', exp({ split_type: 'percentage', splits: [{ user_id: ids.ravi, share_amount: 500, percentage: 50 }, { user_id: ids.sam, share_amount: 500, percentage: 40 }] })))
await ok('percentage split totalling 100 is accepted', async () => save('ravi', exp({ split_type: 'percentage', amount: 100, splits: [{ user_id: ids.ravi, share_amount: 33.33, percentage: 33.333 }, { user_id: ids.sam, share_amount: 33.33, percentage: 33.333 }, { user_id: ids.dev, share_amount: 33.34, percentage: 33.334 }] })))
await denied('missing exchange rate for a non-base currency', () => save('ravi', exp({ fx_rate: null })))
await denied('zero / negative rate rejected', () => save('ravi', exp({ fx_rate: 0 })))
await denied('unsupported currency rejected', () => save('ravi', exp({ currency: 'USD' })))
await denied('payer must be a trip member', () => save('ravi', exp({ payer_id: out })))
await denied('participant must be a trip member', () => save('ravi', exp({ splits: split([['ravi', 500]]).concat([{ user_id: out, share_amount: 500 }]) })))
await denied('duplicate participant rejected', () => save('ravi', exp({ splits: split([['ravi', 500], ['ravi', 500]]) })))
await denied('amount with 3 decimals rejected', () => save('ravi', exp({ amount: 10.005, splits: split([['ravi', 10.01]]) })))
await denied('receipt path must be inside this trip folder', () => save('ravi', exp({ receipt_path: `${out}/x.jpg` })))
await denied('member cannot edit another member\'s expense', () => save('sam', exp({ amount: 2000, splits: split([['ravi', 1000], ['sam', 1000]]) }), e1))
await ok('admin can correct; audit trail records old + new incl. splits', async () => {
  await save('admin', exp({ amount: 1200, splits: split([['ravi', 600], ['sam', 600]]) }), e1)
  const a = (await db.query(`select action, old_row->>'amount' o, new_row->>'amount' n, new_row->'splits_snapshot' s from expense_audit where expense_id='${e1}' order by id`)).rows
  eq(a.length, 2, 'audit rows'); eq(a[1].action, 'update', 'action'); eq(Number(a[1].o), 1000, 'old'); eq(Number(a[1].n), 1200, 'new')
  eq(JSON.parse(JSON.stringify(a[1].s)).length, 2, 'splits in audit') })
await ok('soft delete via delete_expense is audited; member cannot delete others\'', async () => {
  const id = (await save('kiran', exp({ payer_id: ids.kiran, splits: split([['kiran', 500], ['dev', 500]]) }))).rows[0].id
  await denied('sam deletes', () => as('sam', `select delete_expense('${id}')`))
  await as('kiran', `select delete_expense('${id}')`)
  eq((await db.query(`select action from expense_audit where expense_id='${id}' order by id desc limit 1`)).rows[0].action, 'delete', 'audit') })
await ok('personal expense hidden from others incl. admin, splits and audit; no feed event', async () => {
  const feed0 = (await db.query(`select count(*)::int n from activity_feed where verb='expense'`)).rows[0].n
  const id = (await save('sam', exp({ description: 'Souvenir', amount: 100, payer_id: ids.sam, is_personal: true, splits: split([['sam', 100]]) }))).rows[0].id
  for (const u of ['ravi', 'admin']) {
    eq((await as(u, `select count(*)::int n from expenses where id='${id}'`)).rows[0].n, 0, `${u} expense`)
    eq((await as(u, `select count(*)::int n from expense_splits where expense_id='${id}'`)).rows[0].n, 0, `${u} splits`)
    eq((await as(u, `select count(*)::int n from expense_audit where expense_id='${id}'`)).rows[0].n, 0, `${u} audit`) }
  eq((await db.query(`select count(*)::int n from activity_feed where verb='expense'`)).rows[0].n, feed0, 'no feed')
  await denied('admin cannot edit personal (valid payload, fails on ownership)', () => save('admin', exp({ description: 'Souvenir', amount: 100, payer_id: ids.admin, is_personal: true, splits: split([['admin', 100]]) }), id))
  await denied('personal expense cannot be split with others', () => save('sam', exp({ is_personal: true, payer_id: ids.sam, splits: split([['sam', 500], ['ravi', 500]]) }))) })
await ok('feed event written for shared expense', async () =>
  eq((await db.query(`select count(*)::int n from activity_feed where verb='expense' and entity_id='${e1}'`)).rows[0].n >= 2, true, 'feed rows'))
await denied('anon / outsider cannot call save_expense', () => save('outsider', exp()))

console.log('Settlements')
const key = '30000000-0000-4000-8000-000000000001'
await ok('member records settlement', async () => as('sam', `insert into settlements(trip_id,from_user,to_user,amount,currency,idempotency_key,created_by) values ('${T}','${ids.sam}','${ids.ravi}',500,'THB','${key}','${ids.sam}')`))
await ok('settlement writes feed + notifies the other party only', async () => {
  eq((await db.query(`select count(*)::int n from activity_feed where verb='settlement'`)).rows[0].n, 1, 'feed')
  const n = await db.query(`select user_id from notifications where type='settlement'`); eq(n.rows.length, 1, 'rows'); eq(n.rows[0].user_id, ids.ravi, 'recipient') })
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
  eq((await as('sam', `select count(*)::int n from notifications where title='for ravi'`)).rows[0].n, 0, 'sam')
  eq((await as('ravi', `select count(*)::int n from notifications where title='for ravi'`)).rows[0].n, 1, 'ravi')
  eq((await as('sam', `select count(*)::int n from notifications where user_id <> '${ids.sam}'`)).rows[0].n, 0, 'sam sees others') })
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

console.log('Phase 3: notifications + checklist events')
await ok('announcement notifies everyone except the author', async () => {
  const before = (await db.query(`select count(*)::int n from notifications where type='announcement'`)).rows[0].n
  await as('admin', `insert into announcements(trip_id,title,body,importance,created_by) values ('${T}','Bus time changed','Leaves 5pm','urgent','${ids.admin}')`)
  const r = await db.query(`select user_id, title from notifications where type='announcement' order by created_at desc, id desc limit 4`)
  const total = (await db.query(`select count(*)::int n from notifications where type='announcement'`)).rows[0].n
  eq(total - before, 4, 'new notifications'); if (r.rows.some((x) => x.user_id === ids.admin)) throw new Error('author notified')
  if (!r.rows[0].title.startsWith('Urgent: ')) throw new Error('urgent prefix missing') })
await ok('status change notifies others, not the editor', async () => {
  await db.exec(`delete from notifications where type='booking'`)
  await as('admin', `update itinerary_activities set status='cancelled' where title like '%at Railay'`)
  const r = await db.query(`select user_id from notifications where type='booking'`)
  eq(r.rows.length, 4, 'rows'); if (r.rows.some((x) => x.user_id === ids.admin)) throw new Error('editor notified') })
await ok('comment notifies earlier commenters only', async () => {
  await db.exec(`delete from notifications where type='comment'`)
  const a = (await db.query(`select id from itinerary_activities limit 1`)).rows[0].id   // sam commented here earlier
  await as('kiran', `insert into comments(trip_id,target_type,target_id,author_id,body) values ('${T}','activity','${a}','${ids.kiran}','me too')`)
  const r = await db.query(`select user_id from notifications where type='comment'`)
  eq(r.rows.length, 1, 'rows'); eq(r.rows[0].user_id, ids.sam, 'recipient') })
await ok('finishing a whole category writes ONE feed event (ticks alone do not)', async () => {
  const items = (await db.query(`select id from checklist_items where category='Before departure'`)).rows
  const feed0 = (await db.query(`select count(*)::int n from activity_feed where verb='checklist'`)).rows[0].n
  for (const [i, it] of items.entries()) {
    await as('dev', `insert into checklist_completions(item_id,user_id,trip_id) values ($1,'${ids.dev}','${T}')`, [it.id])
    const n = (await db.query(`select count(*)::int n from activity_feed where verb='checklist'`)).rows[0].n
    eq(n, i === items.length - 1 ? feed0 + 1 : feed0, `feed after tick ${i + 1}`) } })
await ok('member can mark own notification read, not someone else\'s', async () => {
  await db.exec(`insert into notifications(trip_id,user_id,type,title) values ('${T}','${ids.ravi}','t','x'),('${T}','${ids.sam}','t','y')`)
  eq((await as('ravi', `update notifications set read_at=now() where title='x'`)).affectedRows, 1, 'own')
  eq((await as('ravi', `update notifications set read_at=now() where title='y'`)).affectedRows, 0, 'other') })
await denied('member cannot rewrite notification text', () => as('ravi', `update notifications set title='hacked' where title='x'`))

console.log('Phase 4: wallet')
let gdoc, pdoc
await ok('group doc visible to all; upload notifies others + feed', async () => {
  await db.exec(`delete from notifications where type='document'`)
  gdoc = (await as('kiran', `insert into documents(trip_id,name,category,storage_path,uploaded_by) values ('${T}','Flight tickets','flight','${T}/g1/tickets.pdf','${ids.kiran}') returning id`)).rows[0].id
  eq((await as('sam', `select count(*)::int n from documents where id='${gdoc}'`)).rows[0].n, 1, 'sam sees')
  eq((await db.query(`select count(*)::int n from notifications where type='document'`)).rows[0].n, 4, 'notified')
  eq((await db.query(`select count(*)::int n from activity_feed where verb='document' and entity_id='${gdoc}'`)).rows[0].n, 1, 'feed') })
await ok('PRIVATE doc: invisible to members AND admin; no feed/notification', async () => {
  const before = (await db.query(`select count(*)::int n from notifications where type='document'`)).rows[0].n
  pdoc = (await as('kiran', `insert into documents(trip_id,name,category,storage_path,uploaded_by,visibility) values ('${T}','My passport','entry','${T}/p1/passport.pdf','${ids.kiran}','private') returning id`)).rows[0].id
  for (const u of ['sam', 'admin', 'dev']) eq((await as(u, `select count(*)::int n from documents where id='${pdoc}'`)).rows[0].n, 0, u)
  eq((await as('kiran', `select count(*)::int n from documents where id='${pdoc}'`)).rows[0].n, 1, 'owner')
  eq((await db.query(`select count(*)::int n from notifications where type='document'`)).rows[0].n, before, 'no notification') })
await denied('admin cannot edit or delete a private doc', () => as('admin', `update documents set deleted_at=now() where id='${pdoc}'`))
await denied('admin cannot flip a group doc to private to hide it', () => as('admin', `update documents set visibility='private' where id='${gdoc}'`))
await ok('admin can soft-delete a group doc; other member cannot', async () => {
  eq((await as('sam', `update documents set deleted_at=now() where id='${gdoc}'`)).affectedRows, 0, 'sam')
  eq((await as('admin', `update documents set notes='checked' where id='${gdoc}'`)).affectedRows, 1, 'admin') })
await denied('member cannot replace (version) someone else\'s doc', () => as('sam', `insert into documents(trip_id,name,category,storage_path,uploaded_by,replaces_id,version) values ('${T}','x','flight','${T}/g2/x.pdf','${ids.sam}','${gdoc}',2)`))
await ok('owner can add a new version; admin can version a group doc', async () => {
  await as('kiran', `insert into documents(trip_id,name,category,storage_path,uploaded_by,replaces_id,version) values ('${T}','Flight tickets','flight','${T}/g3/t2.pdf','${ids.kiran}','${gdoc}',2)`)
  await as('admin', `insert into documents(trip_id,name,category,storage_path,uploaded_by,replaces_id,version) values ('${T}','Flight tickets','flight','${T}/g4/t3.pdf','${ids.admin}','${gdoc}',3)`) })
await denied('admin cannot version a private doc', () => as('admin', `insert into documents(trip_id,name,category,storage_path,uploaded_by,replaces_id,version) values ('${T}','x','entry','${T}/p2/x.pdf','${ids.admin}','${pdoc}',2)`))
await denied('traveller must be a trip member', () => as('kiran', `insert into documents(trip_id,name,category,storage_path,uploaded_by,traveller_id) values ('${T}','x','misc','${T}/z/x.pdf','${ids.kiran}','${out}')`))
await db.exec(`insert into storage.objects(bucket_id,name,owner) values ('documents','${T}/g1/tickets.pdf','${ids.kiran}'),('documents','${T}/p1/passport.pdf','${ids.kiran}')`)
await ok('storage: group file readable by members, PRIVATE file only by owner', async () => {
  const n = async (u, path) => (await as(u, `select count(*)::int n from storage.objects where bucket_id='documents' and name='${path}'`)).rows[0].n
  eq(await n('sam', `${T}/g1/tickets.pdf`), 1, 'sam group'); eq(await n('outsider', `${T}/g1/tickets.pdf`), 0, 'outsider group')
  eq(await n('kiran', `${T}/p1/passport.pdf`), 1, 'owner private')
  for (const u of ['sam', 'admin', 'dev', 'outsider']) eq(await n(u, `${T}/p1/passport.pdf`), 0, `${u} private`) })
await denied('admin cannot delete a private file from storage', () => as('admin', `delete from storage.objects where name='${T}/p1/passport.pdf'`))
await ok('activity edit of time/location/meeting point notifies others; no-op edit does not', async () => {
  await db.exec(`delete from notifications where type='booking'`)
  await as('admin', `update itinerary_activities set start_time='09:00', meeting_point='Lobby' where title like 'Phi Phi%'`)
  const r = await db.query(`select title, body from notifications where type='booking'`)
  eq(r.rows.length, 4, 'rows'); console.log('     ', r.rows[0].title, '|', r.rows[0].body)
  await as('admin', `update itinerary_activities set booking_ref='B1' where title like 'Phi Phi%'`)
  eq((await db.query(`select count(*)::int n from notifications where type='booking'`)).rows[0].n, 4, 'unchanged') })

console.log('Phase 6: social')
const mkPoll = (user, o = {}) => as(user, `select create_poll('${T}', $1, $2, $3, $4) as id`, [o.q ?? 'Where to eat?', o.multi ?? false, o.closes ?? null, o.opts ?? ['Thai', 'Pizza', 'Sushi']])
const optIds = async (poll) => (await db.query(`select id, label from poll_options where poll_id='${poll}' order by sort_order`)).rows.map((r) => r.id)
const vote = (user, poll, opts) => as(user, `select set_poll_votes('${poll}', $1::uuid[])`, [`{${opts.join(',')}}`])
let sp, mp
await ok('admin creates a poll atomically; options ordered; feed + notifications', async () => {
  await db.exec(`delete from notifications where type='poll'`)
  sp = (await mkPoll('admin')).rows[0].id
  eq((await optIds(sp)).length, 3, 'options')
  eq((await db.query(`select count(*)::int n from activity_feed where verb='poll' and entity_id='${sp}'`)).rows[0].n, 1, 'feed')
  eq((await db.query(`select count(*)::int n from notifications where type='poll'`)).rows[0].n, 4, 'notified') })
await denied('member cannot create a poll', () => mkPoll('ravi'))
await denied('poll needs at least 2 distinct options', () => mkPoll('admin', { opts: ['Only one', '  '] }))
await denied('duplicate options rejected (case-insensitive)', () => mkPoll('admin', { opts: ['Thai', 'thai'] }))
await denied('closing time in the past rejected', () => mkPoll('admin', { closes: '2020-01-01T00:00:00Z' }))
await ok('single-choice: vote, then CHANGE vote atomically (one vote remains)', async () => {
  const [a, b] = await optIds(sp)
  await vote('ravi', sp, [a]); await vote('ravi', sp, [b])
  const r = await db.query(`select option_id from poll_votes where poll_id='${sp}' and user_id='${ids.ravi}'`)
  eq(r.rows.length, 1, 'votes'); eq(r.rows[0].option_id, b, 'moved') })
await denied('single-choice poll rejects two options at once', async () => { const [a, b] = await optIds(sp); return vote('sam', sp, [a, b]) })
await denied('option from another poll rejected', async () => { const [x] = await optIds(sp); const other = (await mkPoll('admin', { q: 'Other?', opts: ['A', 'B'] })).rows[0].id; return vote('sam', other, [x]) })
await ok('multiple-choice poll accepts several options; empty array clears', async () => {
  mp = (await mkPoll('admin', { q: 'Activities?', multi: true, opts: ['Kayak', 'Dive', 'Climb'] })).rows[0].id
  const o = await optIds(mp)
  await vote('sam', mp, [o[0], o[2]]); eq((await db.query(`select count(*)::int n from poll_votes where poll_id='${mp}' and user_id='${ids.sam}'`)).rows[0].n, 2, 'two')
  await vote('sam', mp, []); eq((await db.query(`select count(*)::int n from poll_votes where poll_id='${mp}' and user_id='${ids.sam}'`)).rows[0].n, 0, 'cleared') })
await ok('everyone sees results; outsider cannot vote or see', async () => {
  eq((await as('kiran', `select count(*)::int n from poll_votes where poll_id='${sp}'`)).rows[0].n, 1, 'kiran sees')
  eq((await as('outsider', `select count(*)::int n from poll_votes`)).rows[0].n, 0, 'outsider sees')
  await denied('outsider votes', async () => vote('outsider', sp, [(await optIds(sp))[0]])) })
await ok('closed poll rejects voting changes; vote survives', async () => {
  await as('admin', `update polls set closed_at=now() where id='${sp}'`)
  await denied('vote on closed poll', async () => vote('ravi', sp, [(await optIds(sp))[0]]))
  eq((await db.query(`select count(*)::int n from poll_votes where poll_id='${sp}'`)).rows[0].n, 1, 'vote kept') })
await ok('poll past its closing time is closed even if closed_at is null', async () => {
  const id = (await mkPoll('admin', { q: 'Soon?', closes: new Date(Date.now() + 3600e3).toISOString(), opts: ['Yes', 'No'] })).rows[0].id
  await db.exec(`update polls set closes_at = now() - interval '1 minute' where id='${id}'`)
  await denied('vote after deadline', async () => vote('ravi', id, [(await optIds(id))[0]])) })
await ok('announcement writes a feed event', async () => {
  const n = (await db.query(`select count(*)::int n from activity_feed where verb='announcement'`)).rows[0].n
  if (n < 1) throw new Error('no announcement feed row') })
await ok('comment on a feed post notifies the author and earlier commenters, never the commenter', async () => {
  await db.exec(`delete from notifications where type='comment'`)
  const post = (await db.query(`select id from activity_feed where verb='post' and actor_id='${ids.dev}' limit 1`)).rows[0].id
  await as('sam', `insert into comments(trip_id,target_type,target_id,author_id,body) values ('${T}','feed','${post}','${ids.sam}','nice')`)
  eq((await db.query(`select user_id from notifications where type='comment'`)).rows.map((r) => r.user_id).join(), ids.dev, 'first comment -> author only')
  await as('ravi', `insert into comments(trip_id,target_type,target_id,author_id,body) values ('${T}','feed','${post}','${ids.ravi}','agree')`)
  const rec = (await db.query(`select user_id from notifications where type='comment'`)).rows.map((r) => r.user_id).sort()
  eq(rec.join(), [ids.dev, ids.dev, ids.sam].sort().join(), 'second comment -> author + sam')
  if (rec.includes(ids.ravi)) throw new Error('commenter notified') })
await ok('reactions: one per emoji per user; unknown emoji rejected', async () => {
  const post = (await db.query(`select id from activity_feed where verb='post' limit 1`)).rows[0].id
  await as('sam', `insert into reactions(trip_id,target_type,target_id,user_id,emoji) values ('${T}','feed','${post}','${ids.sam}','🔥')`)
  await denied('duplicate reaction', () => as('sam', `insert into reactions(trip_id,target_type,target_id,user_id,emoji) values ('${T}','feed','${post}','${ids.sam}','🔥')`))
  await denied('unknown emoji', () => as('sam', `insert into reactions(trip_id,target_type,target_id,user_id,emoji) values ('${T}','feed','${post}','${ids.sam}','💩')`))
  await denied('react as someone else', () => as('sam', `insert into reactions(trip_id,target_type,target_id,user_id,emoji) values ('${T}','feed','${post}','${ids.ravi}','❤️')`))
  eq((await as('sam', `delete from reactions where user_id='${ids.sam}'`)).affectedRows, 1, 'remove own') })

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
