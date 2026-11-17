-- Phase 5: expenses. All expense writes go through validated SECURITY DEFINER functions
-- (atomic: expense + participants + splits + audit + feed + notifications). Direct table writes are revoked,
-- so split sums, FX rates and permissions cannot be bypassed from the client.

alter table public.expenses add column splits_snapshot jsonb;   -- copy of the splits, so audit rows are complete

revoke insert, update, delete on public.expenses, public.expense_participants, public.expense_splits from authenticated;

create or replace function public.fmt_money(a numeric, c text) returns text
language sql immutable as $$ select c || ' ' || to_char(a, 'FM999,999,990.00') $$;

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

  -- explicit conversion rate (base currency per 1 unit of the expense currency), stored on the row
  if v_cur = t.base_currency then v_rate := 1; else v_rate := (p->>'fx_rate')::numeric; end if;
  if v_rate is null or v_rate <= 0 or v_rate > 100000 then raise exception 'A positive exchange rate is required'; end if;
  v_rate := round(v_rate, 6);
  v_base := round(v_amount * v_rate, 2);
  if v_base <= 0 then raise exception 'Converted amount is too small'; end if;

  if not is_member_of(p_trip, v_payer) then raise exception 'Payer must be a trip member'; end if;
  if v_type not in ('equal','custom','percentage') then raise exception 'Unknown split type'; end if;
  if v_receipt is not null and left(v_receipt, 37) <> p_trip::text || '/' then raise exception 'Invalid receipt path'; end if;

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
      select p_trip, (e->>'user_id')::uuid, 'expense', msg, 'Your share: ' || fmt_money((e->>'share_amount')::numeric, v_cur), '/expenses'
      from jsonb_array_elements(v_norm) e
      where (e->>'user_id')::uuid <> uid and (e->>'share_amount')::numeric > 0;
  end if;
  return v_id;
end $$;

create or replace function public.delete_expense(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e expenses%rowtype; who text;
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into e from expenses where id = p_id for update;
  if not found or e.deleted_at is not null then raise exception 'Expense not found'; end if;
  if not is_trip_member(e.trip_id) or not (e.created_by = uid or (is_trip_admin(e.trip_id) and not e.is_personal)) then
    raise exception 'You can only delete your own expenses' using errcode = '42501'; end if;
  update expenses set deleted_at = now(), updated_by = uid where id = p_id;
  if not e.is_personal then
    select display_name into who from profiles where id = uid;
    insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
      values (e.trip_id, uid, 'expense', 'expense', p_id, who || ' deleted "' || e.description || '"');
  end if;
end $$;

revoke all on function public.save_expense(uuid, uuid, jsonb), public.delete_expense(uuid) from public, anon;
grant execute on function public.save_expense(uuid, uuid, jsonb), public.delete_expense(uuid) to authenticated;

-- ---------- settlements: feed + notify the other party ----------
create or replace function public.feed_notify_on_settlement() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; b text; msg text;
begin
  select display_name into a from profiles where id = new.from_user;
  select display_name into b from profiles where id = new.to_user;
  msg := a || ' paid ' || b || ' ' || fmt_money(new.amount, new.currency);
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
    values (new.trip_id, new.created_by, 'settlement', 'settlement', new.id, msg);
  insert into notifications (trip_id, user_id, type, title, body, link)
    select new.trip_id, u, 'settlement', msg, new.note, '/expenses'
    from unnest(array[new.from_user, new.to_user]) u where u <> new.created_by;
  return new;
end $$;
create trigger trg_settlements_feed after insert on public.settlements
  for each row execute function public.feed_notify_on_settlement();

-- ---------- receipts bucket: follows the expenses table (personal receipts stay private) ----------
drop policy "receipts_read" on storage.objects;
drop policy "receipts_update" on storage.objects;
drop policy "receipts_delete" on storage.objects;
create policy "receipts_read" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_trip_member(((storage.foldername(name))[1])::uuid)
    and (owner = auth.uid() or exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name)));
create policy "receipts_update" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name))));
create policy "receipts_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or (public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.expenses e where e.receipt_path = storage.objects.name))));
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
  where id = 'receipts';
