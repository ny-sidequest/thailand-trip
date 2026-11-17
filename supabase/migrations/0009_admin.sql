-- Phase 7: admin tooling support.

-- Reorder a day's activities atomically; the list must contain exactly that day's live activities.
create or replace function public.reorder_activities(p_day uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select trip_id into t from itinerary_days where id = p_day and deleted_at is null;
  if t is null or not is_trip_admin(t) then raise exception 'Only the trip admin can reorder' using errcode = '42501'; end if;
  if (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or (select count(*) from itinerary_activities where day_id = p_day and deleted_at is null) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists
                (select 1 from itinerary_activities a where a.id = x and a.day_id = p_day and a.deleted_at is null)) then
    raise exception 'The list must contain exactly the activities of this day';
  end if;
  update itinerary_activities a set sort_order = o.ord::int
    from unnest(p_ids) with ordinality as o(id, ord) where a.id = o.id;
end $$;

-- Soft-delete a day together with its activities.
create or replace function public.delete_day(p_day uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  select trip_id into t from itinerary_days where id = p_day and deleted_at is null;
  if t is null or not is_trip_admin(t) then raise exception 'Only the trip admin can delete days' using errcode = '42501'; end if;
  update itinerary_activities set deleted_at = now() where day_id = p_day and deleted_at is null;
  update itinerary_days set deleted_at = now() where id = p_day;
end $$;

revoke all on function public.reorder_activities(uuid, uuid[]), public.delete_day(uuid) from public, anon;
grant execute on function public.reorder_activities(uuid, uuid[]), public.delete_day(uuid) to authenticated;

-- Booking status changes (stays / transport / activity bookings) -> feed + notifications
create or replace function public.feed_notify_on_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text; who text; msg text; lnk text;
begin
  if new.status is not distinct from old.status or auth.uid() is null then return new; end if;
  if tg_table_name = 'transport_bookings' then label := new.origin || ' → ' || new.destination; lnk := '/wallet/transport';
  elsif tg_table_name = 'accommodation_bookings' then label := new.name; lnk := '/wallet/stays';
  else label := new.name; lnk := '/itinerary'; end if;
  select display_name into who from profiles where id = auth.uid();
  msg := coalesce(who, 'Admin') || ' changed "' || label || '" to ' || initcap(replace(new.status::text, '_', ' '));
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
    values (new.trip_id, auth.uid(), 'booking', tg_table_name, new.id, msg);
  perform notify_members(new.trip_id, auth.uid(), 'booking', msg, null, lnk);
  return new;
end $$;
create trigger trg_accommodation_status_feed after update on public.accommodation_bookings
  for each row execute function public.feed_notify_on_booking_status();
create trigger trg_transport_status_feed after update on public.transport_bookings
  for each row execute function public.feed_notify_on_booking_status();
create trigger trg_activity_bookings_status_feed after update on public.activity_bookings
  for each row execute function public.feed_notify_on_booking_status();
