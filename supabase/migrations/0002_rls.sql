-- Row Level Security. Default deny; anon gets nothing.
-- Soft-deleted rows stay SELECT-able by members (clients filter deleted_at) so that
-- soft-delete UPDATEs never trip over the SELECT policy.

-- ---------- helper functions (SECURITY DEFINER avoids recursive RLS) ----------
create or replace function public.is_trip_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid()) $$;

create or replace function public.is_trip_admin(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = auth.uid() and role = 'admin') $$;

create or replace function public.is_member_of(t uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = t and user_id = u) $$;

create or replace function public.shares_trip_with(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members a join trip_members b on a.trip_id = b.trip_id
                 where a.user_id = auth.uid() and b.user_id = u) $$;

create or replace function public.expense_visible(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from expenses e where e.id = eid and is_trip_member(e.trip_id)
                 and (not e.is_personal or e.created_by = auth.uid())) $$;

create or replace function public.expense_editable(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from expenses e where e.id = eid and is_trip_member(e.trip_id)
                 and (e.created_by = auth.uid() or (is_trip_admin(e.trip_id) and not e.is_personal))) $$;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array['trips','profiles','trip_members','itinerary_days','itinerary_activities',
    'checklist_items','checklist_completions','documents','accommodation_bookings','transport_bookings',
    'activity_bookings','expenses','expense_participants','expense_splits','expense_audit','settlements',
    'announcements','announcement_reads','activity_feed','comments','reactions','polls','poll_options',
    'poll_votes','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------- trips / profiles / membership ----------
create policy trips_select on public.trips for select to authenticated using (is_trip_member(id));
create policy trips_update on public.trips for update to authenticated
  using (is_trip_admin(id)) with check (is_trip_admin(id));

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or shares_trip_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- members may only change presentational columns (username/id are immutable from the client)
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, phone, emergency_contact) on public.profiles to authenticated;

create policy members_select on public.trip_members for select to authenticated
  using (is_trip_member(trip_id));
-- membership/roles are written only by the service role (admin-users function / provisioning script)
revoke insert, update, delete on public.trip_members from authenticated;
revoke insert, delete on public.trips, public.profiles from authenticated;

-- ---------- admin-managed shared content: members read, admins write ----------
do $$
declare t text;
begin
  foreach t in array array['itinerary_days','itinerary_activities','checklist_items',
    'accommodation_bookings','transport_bookings','activity_bookings','polls','poll_options','announcements'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (is_trip_member(trip_id))', t);
    execute format('create policy %1$s_admin_ins on public.%1$s for insert to authenticated with check (is_trip_admin(trip_id))', t);
    execute format('create policy %1$s_admin_upd on public.%1$s for update to authenticated
                    using (is_trip_admin(trip_id)) with check (is_trip_admin(trip_id))', t);
    execute format('create policy %1$s_admin_del on public.%1$s for delete to authenticated using (is_trip_admin(trip_id))', t);
  end loop;
end $$;

-- ---------- checklist completions: personal ----------
create policy cc_select on public.checklist_completions for select to authenticated
  using (user_id = auth.uid() or is_trip_admin(trip_id));
create policy cc_insert on public.checklist_completions for insert to authenticated
  with check (user_id = auth.uid() and is_trip_member(trip_id)
    and exists (select 1 from checklist_items i where i.id = item_id and i.trip_id = checklist_completions.trip_id));
create policy cc_delete on public.checklist_completions for delete to authenticated
  using (user_id = auth.uid());

-- Group progress without exposing who ticked which item
create or replace function public.checklist_progress(t uuid)
returns table (user_id uuid, completed bigint, total bigint)
language sql stable security definer set search_path = public as $$
  select m.user_id,
    (select count(*) from checklist_completions c join checklist_items i on i.id = c.item_id
       where c.user_id = m.user_id and i.trip_id = t and i.deleted_at is null),
    (select count(*) from checklist_items i where i.trip_id = t and i.deleted_at is null)
  from trip_members m where m.trip_id = t and is_trip_member(t) $$;
revoke all on function public.checklist_progress(uuid) from public, anon;
grant execute on function public.checklist_progress(uuid) to authenticated;

-- ---------- documents ----------
create policy docs_select on public.documents for select to authenticated using (is_trip_member(trip_id));
create policy docs_insert on public.documents for insert to authenticated
  with check (is_trip_member(trip_id) and uploaded_by = auth.uid());
create policy docs_update on public.documents for update to authenticated
  using (uploaded_by = auth.uid() or is_trip_admin(trip_id))
  with check (is_trip_member(trip_id) and (uploaded_by = auth.uid() or is_trip_admin(trip_id)));

-- ---------- expenses ----------
create policy exp_select on public.expenses for select to authenticated
  using (is_trip_member(trip_id) and (not is_personal or created_by = auth.uid()));
create policy exp_insert on public.expenses for insert to authenticated
  with check (is_trip_member(trip_id) and created_by = auth.uid() and is_member_of(trip_id, payer_id));
create policy exp_update on public.expenses for update to authenticated
  using (is_trip_member(trip_id) and (created_by = auth.uid() or (is_trip_admin(trip_id) and not is_personal)))
  with check (is_trip_member(trip_id) and is_member_of(trip_id, payer_id));
-- no hard deletes: soft delete via deleted_at (audited)

create policy ep_select on public.expense_participants for select to authenticated using (expense_visible(expense_id));
create policy ep_write on public.expense_participants for all to authenticated
  using (expense_editable(expense_id))
  with check (expense_editable(expense_id) and is_member_of(trip_id, user_id)
    and trip_id = (select e.trip_id from expenses e where e.id = expense_id));
create policy es_select on public.expense_splits for select to authenticated using (expense_visible(expense_id));
create policy es_write on public.expense_splits for all to authenticated
  using (expense_editable(expense_id))
  with check (expense_editable(expense_id) and is_member_of(trip_id, user_id)
    and trip_id = (select e.trip_id from expenses e where e.id = expense_id));
create policy ea_select on public.expense_audit for select to authenticated using (expense_visible(expense_id));

-- ---------- settlements ----------
create policy set_select on public.settlements for select to authenticated using (is_trip_member(trip_id));
create policy set_insert on public.settlements for insert to authenticated
  with check (is_trip_member(trip_id) and created_by = auth.uid()
    and is_member_of(trip_id, from_user) and is_member_of(trip_id, to_user)
    and (from_user = auth.uid() or to_user = auth.uid() or is_trip_admin(trip_id)));
create policy set_update on public.settlements for update to authenticated
  using (created_by = auth.uid() or is_trip_admin(trip_id))
  with check (is_trip_member(trip_id));

-- ---------- announcements read receipts ----------
create policy ar_select on public.announcement_reads for select to authenticated
  using (user_id = auth.uid() or is_trip_admin(trip_id));
create policy ar_insert on public.announcement_reads for insert to authenticated
  with check (user_id = auth.uid() and is_trip_member(trip_id)
    and exists (select 1 from announcements a where a.id = announcement_id and a.trip_id = announcement_reads.trip_id));
create policy ar_delete on public.announcement_reads for delete to authenticated using (user_id = auth.uid());

-- ---------- feed / comments / reactions ----------
create policy feed_select on public.activity_feed for select to authenticated using (is_trip_member(trip_id));
create policy feed_insert on public.activity_feed for insert to authenticated
  with check (is_trip_member(trip_id) and actor_id = auth.uid() and verb in ('post','photo'));
create policy feed_update on public.activity_feed for update to authenticated
  using (actor_id = auth.uid() or is_trip_admin(trip_id))
  with check (is_trip_member(trip_id));

create policy com_select on public.comments for select to authenticated using (is_trip_member(trip_id));
create policy com_insert on public.comments for insert to authenticated
  with check (is_trip_member(trip_id) and author_id = auth.uid());
create policy com_update on public.comments for update to authenticated
  using (author_id = auth.uid() or is_trip_admin(trip_id))
  with check (is_trip_member(trip_id));

create policy rx_select on public.reactions for select to authenticated using (is_trip_member(trip_id));
create policy rx_insert on public.reactions for insert to authenticated
  with check (is_trip_member(trip_id) and user_id = auth.uid());
create policy rx_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- ---------- polls ----------
create policy pv_select on public.poll_votes for select to authenticated using (is_trip_member(trip_id));
create policy pv_insert on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and is_trip_member(trip_id)
    and exists (select 1 from polls p join poll_options o on o.poll_id = p.id
      where p.id = poll_votes.poll_id and o.id = poll_votes.option_id and p.trip_id = poll_votes.trip_id
        and p.deleted_at is null and p.closed_at is null and (p.closes_at is null or p.closes_at > now())));
create policy pv_delete on public.poll_votes for delete to authenticated
  using (user_id = auth.uid()
    and exists (select 1 from polls p where p.id = poll_votes.poll_id
      and p.closed_at is null and (p.closes_at is null or p.closes_at > now())));

-- single-choice polls: a second, different vote is rejected (client deletes the old vote first)
create or replace function public.enforce_single_choice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not (select multiple_choice from polls where id = new.poll_id)
     and exists (select 1 from poll_votes where poll_id = new.poll_id and user_id = new.user_id) then
    raise exception 'This poll allows only one choice' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_single_choice before insert on public.poll_votes
  for each row execute function public.enforce_single_choice();

-- ---------- notifications: own only, only read_at is client-writable ----------
create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------- column hardening: audit fields are not client-forgeable ----------
-- created_by/uploaded_by/actor_id are pinned by INSERT policies; block later reassignment.
create or replace function public.lock_owner_columns() returns trigger
language plpgsql as $$
declare c text; o jsonb := to_jsonb(old); n jsonb := to_jsonb(new);
begin
  foreach c in array array['trip_id','created_by','uploaded_by','actor_id','author_id'] loop
    if n ? c and (n->>c) is distinct from (o->>c) then
      raise exception '% is immutable', c using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['itinerary_days','itinerary_activities','checklist_items','accommodation_bookings',
    'transport_bookings','activity_bookings','documents','expenses','settlements','announcements',
    'activity_feed','comments','polls'] loop
    execute format('create trigger trg_%s_lock before update on public.%I
      for each row execute function public.lock_owner_columns()', t, t);
  end loop;
end $$;
