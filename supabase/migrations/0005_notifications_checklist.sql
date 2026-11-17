-- Phase 3: notification generators + checklist feed events. All SECURITY DEFINER:
-- clients can never insert notifications or system feed events themselves.

create or replace function public.notify_members(
  p_trip uuid, p_exclude uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (trip_id, user_id, type, title, body, link)
  select p_trip, m.user_id, p_type, p_title, p_body, p_link
  from trip_members m where m.trip_id = p_trip and m.user_id is distinct from p_exclude $$;
revoke all on function public.notify_members(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- New announcement -> everyone except the author
create or replace function public.notify_on_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_members(new.trip_id, new.created_by, 'announcement',
    case new.importance when 'urgent' then 'Urgent: ' || new.title else new.title end,
    left(new.body, 160), '/');
  return new;
end $$;
create trigger trg_announcements_notify after insert on public.announcements
  for each row execute function public.notify_on_announcement();

-- Activity status change -> everyone except the person who changed it
create or replace function public.notify_on_activity_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform notify_members(new.trip_id, auth.uid(), 'booking',
      new.title || ' is now ' || initcap(replace(new.status::text, '_', ' ')), null,
      '/itinerary/activity/' || new.id);
  end if;
  return new;
end $$;
create trigger trg_activities_status_notify after update on public.itinerary_activities
  for each row execute function public.notify_on_activity_status();

-- New comment -> people who already commented on the same activity (not the author)
create or replace function public.notify_on_activity_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_title text; who text;
begin
  if new.target_type <> 'activity' then return new; end if;
  select title into a_title from itinerary_activities where id = new.target_id;
  select display_name into who from profiles where id = new.author_id;
  insert into notifications (trip_id, user_id, type, title, body, link)
  select distinct new.trip_id, c.author_id, 'comment',
         who || ' commented on ' || coalesce(a_title, 'an activity'), left(new.body, 160),
         '/itinerary/activity/' || new.target_id
  from comments c
  where c.trip_id = new.trip_id and c.target_type = 'activity' and c.target_id = new.target_id
    and c.author_id <> new.author_id and c.deleted_at is null;
  return new;
end $$;
create trigger trg_comments_notify after insert on public.comments
  for each row execute function public.notify_on_activity_comment();

-- Feed event when someone finishes a whole checklist category (not one per tick)
create or replace function public.feed_on_checklist_category() returns trigger
language plpgsql security definer set search_path = public as $$
declare cat text; remaining int; who text;
begin
  select category into cat from checklist_items where id = new.item_id;
  if cat is null then return new; end if;
  select count(*) into remaining from checklist_items i
   where i.trip_id = new.trip_id and i.category = cat and i.deleted_at is null
     and not exists (select 1 from checklist_completions c where c.item_id = i.id and c.user_id = new.user_id);
  if remaining = 0 then
    select display_name into who from profiles where id = new.user_id;
    insert into activity_feed (trip_id, actor_id, verb, entity_type, summary)
    values (new.trip_id, new.user_id, 'checklist', 'checklist', who || ' completed "' || cat || '"');
  end if;
  return new;
end $$;
create trigger trg_completions_feed after insert on public.checklist_completions
  for each row execute function public.feed_on_checklist_category();
