-- Phase 8 security hardening, from an independent audit (every item below has a regression test in scripts/test-db.mjs).
--  1. Settlements can only be written through validated functions (rate forced to 1 for the base currency, bounded otherwise).
--  2. Exchange rates are bounded to 50%-200% of the trip default for expenses and settlements.
--  3. Storage objects can no longer be exposed by forged "pointer" rows: paths are bound to their own row, immutable, and
--     storage policies also require the row's uploader to be the object's owner.
--  4. Column-level update grants on documents / comments / feed events (no rewriting of verbs, targets, version chains).
--  5. Membership helper functions are no longer callable by anon (no membership oracle).
--  6. Checklist completions leave the realtime publication (DELETE events bypass RLS); a content-free ping replaces them.
--  7. MIME allow-lists on the photos and avatars buckets.

-- ---------- 5. helper functions: authenticated only ----------
revoke execute on function public.is_trip_member(uuid), public.is_trip_admin(uuid), public.is_member_of(uuid, uuid),
  public.shares_trip_with(uuid), public.expense_visible(uuid), public.expense_editable(uuid) from public, anon;
grant execute on function public.is_trip_member(uuid), public.is_trip_admin(uuid), public.is_member_of(uuid, uuid),
  public.shares_trip_with(uuid), public.expense_visible(uuid), public.expense_editable(uuid) to authenticated;

-- ---------- 2. exchange-rate normalisation (internal) ----------
create or replace function public.normalize_fx(p_trip uuid, p_cur text, p_rate numeric) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare t trips%rowtype; expected numeric;
begin
  select * into t from trips where id = p_trip;
  if p_cur = t.base_currency then return 1; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'A positive exchange rate is required'; end if;
  expected := case when t.base_currency = 'INR' then t.default_thb_to_inr else 1 / t.default_thb_to_inr end;
  if p_rate < expected * 0.5 or p_rate > expected * 2 then
    raise exception 'Exchange rate must be between % and % (trip default %). If the real rate has moved, ask the admin to update the default in Trip settings.',
      round(expected * 0.5, 4), round(expected * 2, 4), round(expected, 4);
  end if;
  return round(p_rate, 6);
end $$;
revoke all on function public.normalize_fx(uuid, text, numeric) from public, anon, authenticated;

-- ---------- expenses: save_expense re-created with bounded rate, receipt binding, base amount in notification ----------
create or replace function public.save_expense(p_trip uuid, p_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t trips%rowtype;
  old expenses%rowtype;
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_desc text := btrim(coalesce(p->>'description', ''));
  v_cat text := coalesce(p->>'category', 'other');
  v_raw numeric := (p->>'amount')::numeric;
  v_amount numeric(12,2);
  v_cur text := p->>'currency';
  v_rate numeric;
  v_base numeric(12,2);
  v_date date := coalesce((p->>'expense_date')::date, current_date);
  v_payer uuid := (p->>'payer_id')::uuid;
  v_type text := coalesce(p->>'split_type', 'equal');
  v_personal boolean := coalesce((p->>'is_personal')::boolean, false);
  v_notes text := nullif(btrim(coalesce(p->>'notes', '')), '');
  v_receipt text := nullif(p->>'receipt_path', '');
  v_splits jsonb := p->'splits';
  v_norm jsonb;
  n int; v_sum numeric; v_pct numeric; v_min numeric; v_max numeric; v_dist int;
  r record; who text; is_new boolean; msg text;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not is_trip_member(p_trip) then raise exception 'Not a member of this trip' using errcode = '42501'; end if;
  select * into t from trips where id = p_trip;

  if char_length(v_desc) not between 1 and 160 then raise exception 'Description must be 1-160 characters'; end if;
  if v_cat not in ('food','drinks','transport','accommodation','activities','shopping','nightlife','tickets','other') then
    raise exception 'Unknown category'; end if;
  if v_raw is null or v_raw <= 0 or v_raw >= 10000000 then raise exception 'Amount must be greater than 0'; end if;
  v_amount := round(v_raw, 2);
  if v_amount <> v_raw then raise exception 'Amount can have at most 2 decimal places'; end if;
  if v_cur not in ('THB','INR') then raise exception 'Currency must be THB or INR'; end if;

  -- explicit conversion rate (base currency per 1 unit of the expense currency), stored on the row;
  -- forced to 1 for the base currency and bounded to 50%-200% of the trip default otherwise
  v_rate := normalize_fx(p_trip, v_cur, (p->>'fx_rate')::numeric);
  v_base := round(v_amount * v_rate, 2);
  if v_base <= 0 then raise exception 'Converted amount is too small'; end if;

  if not is_member_of(p_trip, v_payer) then raise exception 'Payer must be a trip member'; end if;
  if v_type not in ('equal','custom','percentage') then raise exception 'Unknown split type'; end if;
  if v_receipt is not null and left(v_receipt, 74) <> p_trip::text || '/' || v_id::text || '/' then raise exception 'Invalid receipt path'; end if;

  -- splits: array of {user_id, share_amount, percentage?}; shares must sum EXACTLY to the amount
  if v_splits is null or jsonb_typeof(v_splits) <> 'array' then raise exception 'Splits are required'; end if;
  n := jsonb_array_length(v_splits);
  if n < 1 or n > 50 then raise exception 'Choose at least one participant'; end if;
  select count(distinct (e->>'user_id')), coalesce(sum(round((e->>'share_amount')::numeric, 2)), 0),
         min(round((e->>'share_amount')::numeric, 2)), max(round((e->>'share_amount')::numeric, 2)),
         coalesce(sum((e->>'percentage')::numeric), 0)
    into v_dist, v_sum, v_min, v_max, v_pct
  from jsonb_array_elements(v_splits) e;
  if v_dist <> n then raise exception 'A participant is listed twice'; end if;
  for r in select (e->>'user_id')::uuid as uid2, (e->>'share_amount')::numeric as sh from jsonb_array_elements(v_splits) e loop
    if not is_member_of(p_trip, r.uid2) then raise exception 'Participant is not a trip member'; end if;
    if r.sh is null or r.sh < 0 or round(r.sh, 2) <> r.sh then raise exception 'Invalid share amount'; end if;
  end loop;
  if v_sum <> v_amount then raise exception 'Shares add up to % but the amount is %', v_sum, v_amount; end if;
  if v_type = 'equal' and v_max - v_min > 0.01 then raise exception 'Equal split shares differ by more than 0.01'; end if;
  if v_type = 'percentage' and abs(v_pct - 100) > 0.001 then raise exception 'Percentages must add up to 100'; end if;
  if v_personal and (n <> 1 or v_payer <> uid or (v_splits->0->>'user_id')::uuid <> uid) then
    raise exception 'A personal expense must be paid by and split only to you'; end if;

  select jsonb_agg(jsonb_build_object('user_id', e->>'user_id', 'share_amount', round((e->>'share_amount')::numeric, 2),
                                      'percentage', e->'percentage') order by e->>'user_id')
    into v_norm from jsonb_array_elements(v_splits) e;

  is_new := not exists (select 1 from expenses where id = v_id);
  if is_new then
    insert into expenses (id, trip_id, description, category, amount, currency, fx_rate_to_base, amount_base, expense_date,
                          payer_id, split_type, is_personal, receipt_path, notes, created_by, splits_snapshot)
    values (v_id, p_trip, v_desc, v_cat, v_amount, v_cur, v_rate, v_base, v_date, v_payer, v_type, v_personal,
            v_receipt, v_notes, uid, v_norm);
  else
    select * into old from expenses where id = v_id for update;
    if old.trip_id <> p_trip or old.deleted_at is not null then raise exception 'Expense not found'; end if;
    if not (old.created_by = uid or (is_trip_admin(p_trip) and not old.is_personal)) then
      raise exception 'You can only edit your own expenses' using errcode = '42501'; end if;
    if old.is_personal <> v_personal then raise exception 'Cannot change between personal and shared'; end if;
    update expenses set description = v_desc, category = v_cat, amount = v_amount, currency = v_cur,
      fx_rate_to_base = v_rate, amount_base = v_base, expense_date = v_date, payer_id = v_payer, split_type = v_type,
      receipt_path = v_receipt, notes = v_notes, updated_by = uid, splits_snapshot = v_norm
    where id = v_id;
    delete from expense_splits where expense_id = v_id;
    delete from expense_participants where expense_id = v_id;
  end if;

  insert into expense_participants (expense_id, user_id, trip_id)
    select v_id, (e->>'user_id')::uuid, p_trip from jsonb_array_elements(v_norm) e;
  insert into expense_splits (expense_id, user_id, trip_id, share_amount, percentage)
    select v_id, (e->>'user_id')::uuid, p_trip, (e->>'share_amount')::numeric,
           nullif(e->>'percentage', 'null')::numeric from jsonb_array_elements(v_norm) e;

  if not v_personal then
    select display_name into who from profiles where id = uid;
    msg := who || case when is_new then ' added "' else ' corrected "' end || v_desc || '" (' || fmt_money(v_amount, v_cur) || ')';
    insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
      values (p_trip, uid, 'expense', 'expense', v_id, msg);
    insert into notifications (trip_id, user_id, type, title, body, link)
      select p_trip, (e->>'user_id')::uuid, 'expense', msg, 'Your share: ' || fmt_money((e->>'share_amount')::numeric, v_cur)
        || case when v_cur <> t.base_currency then ' (about ' || fmt_money(round((e->>'share_amount')::numeric * v_rate, 2), t.base_currency) || ')' else '' end, '/expenses'
      from jsonb_array_elements(v_norm) e
      where (e->>'user_id')::uuid <> uid and (e->>'share_amount')::numeric > 0;
  end if;
  return v_id;
end $$;

-- ---------- 1. settlements via functions only ----------
revoke insert, update, delete on public.settlements from authenticated;

create or replace function public.record_settlement(
  p_trip uuid, p_from uuid, p_to uuid, p_amount numeric, p_currency text, p_rate numeric, p_note text, p_date date, p_key uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_rate numeric; v_id uuid; v_existing settlements%rowtype; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not is_trip_member(p_trip) then raise exception 'Not a member of this trip' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from = p_to then raise exception 'Choose two different people'; end if;
  if not is_member_of(p_trip, p_from) or not is_member_of(p_trip, p_to) then raise exception 'Both people must be trip members'; end if;
  if not (p_from = uid or p_to = uid or is_trip_admin(p_trip)) then
    raise exception 'You can only record payments you made or received' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 10000000 or round(p_amount, 2) <> p_amount then
    raise exception 'Amount must be greater than 0 and have at most 2 decimals'; end if;
  if p_currency not in ('THB', 'INR') then raise exception 'Currency must be THB or INR'; end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception 'Note is too long'; end if;
  if p_key is null then raise exception 'Missing idempotency key'; end if;
  v_rate := normalize_fx(p_trip, p_currency, p_rate);

  select * into v_existing from settlements where trip_id = p_trip and idempotency_key = p_key;
  if found then
    if v_existing.created_by <> uid then raise exception 'Duplicate key' using errcode = '23505'; end if;
    return v_existing.id;      -- safe replay of the same submission
  end if;
  insert into settlements (trip_id, from_user, to_user, amount, currency, fx_rate_to_base, note, settled_on, idempotency_key, created_by)
    values (p_trip, p_from, p_to, p_amount, p_currency, v_rate, v_note, coalesce(p_date, current_date), p_key, uid)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_settlement(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s settlements%rowtype; who text;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into s from settlements where id = p_id for update;
  if not found or s.deleted_at is not null then raise exception 'Payment not found'; end if;
  if not is_trip_member(s.trip_id) or not (s.created_by = uid or is_trip_admin(s.trip_id)) then
    raise exception 'You can only remove payments you recorded' using errcode = '42501'; end if;
  update settlements set deleted_at = now() where id = p_id;
  select display_name into who from profiles where id = uid;
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
    values (s.trip_id, uid, 'settlement', 'settlement', p_id, who || ' removed a recorded payment of ' || fmt_money(s.amount, s.currency));
end $$;
revoke all on function public.record_settlement(uuid, uuid, uuid, numeric, text, numeric, text, date, uuid), public.delete_settlement(uuid) from public, anon;
grant execute on function public.record_settlement(uuid, uuid, uuid, numeric, text, numeric, text, date, uuid), public.delete_settlement(uuid) to authenticated;

-- ---------- 3. storage pointer forgery ----------
create or replace function public.check_document_path() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if left(new.storage_path, 74) <> new.trip_id::text || '/' || new.id::text || '/' then
      raise exception 'Invalid storage path' using errcode = '42501'; end if;
  elsif new.storage_path is distinct from old.storage_path then
    raise exception 'storage_path is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_documents_path before insert or update on public.documents
  for each row execute function public.check_document_path();

drop policy "documents_read" on storage.objects;
drop policy "documents_update" on storage.objects;
drop policy "documents_delete" on storage.objects;
create policy "documents_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_trip_member(((storage.foldername(name))[1])::uuid)
    and (owner = auth.uid() or exists (select 1 from public.documents d where d.storage_path = storage.objects.name and d.uploaded_by = storage.objects.owner)));
create policy "documents_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name and d.uploaded_by = storage.objects.owner))));
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name and d.uploaded_by = storage.objects.owner))));

drop policy "receipts_read" on storage.objects;
drop policy "receipts_update" on storage.objects;
drop policy "receipts_delete" on storage.objects;
create policy "receipts_read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_trip_member(((storage.foldername(name))[1])::uuid)
    and (owner = auth.uid() or exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name
         and (e.created_by = storage.objects.owner or e.updated_by = storage.objects.owner))));
create policy "receipts_update" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name and e.created_by = storage.objects.owner))));
create policy "receipts_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name and e.created_by = storage.objects.owner))));

-- ---------- 4. column-level update grants ----------
revoke update on public.documents from authenticated;
grant update (name, category, related_date, related_booking_type, related_booking_id, traveller_id, notes, visibility, deleted_at)
  on public.documents to authenticated;
revoke update on public.comments from authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
revoke update on public.activity_feed from authenticated;
grant update (deleted_at) on public.activity_feed to authenticated;

-- ---------- 6. realtime: no checklist DELETE leak ----------
create table public.checklist_pings (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.checklist_pings (trip_id, created_at);
alter table public.checklist_pings enable row level security;
revoke all on public.checklist_pings from anon;
revoke insert, update, delete on public.checklist_pings from authenticated;
create policy pings_select on public.checklist_pings for select to authenticated using (is_trip_member(trip_id));

create or replace function public.ping_checklist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into checklist_pings (trip_id) values (coalesce(new.trip_id, old.trip_id));
  delete from checklist_pings where created_at < now() - interval '1 day';
  return null;
end $$;
create trigger trg_completions_ping after insert or delete on public.checklist_completions
  for each row execute function public.ping_checklist();

alter publication supabase_realtime drop table public.checklist_completions;
alter publication supabase_realtime add table public.checklist_pings;

-- ---------- 7. MIME allow-lists ----------
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'] where id = 'photos';
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
