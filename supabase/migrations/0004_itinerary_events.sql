-- Phase 2: feed events for itinerary activity comments and status changes.
-- SECURITY DEFINER so clients still cannot insert system events themselves.

create or replace function public.feed_on_activity_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_title text; who text;
begin
  if new.target_type <> 'activity' then return new; end if;
  select title into a_title from itinerary_activities where id = new.target_id and trip_id = new.trip_id;
  if a_title is null then return new; end if;
  select display_name into who from profiles where id = new.author_id;
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary, body)
  values (new.trip_id, new.author_id, 'comment', 'activity', new.target_id,
          who || ' commented on "' || a_title || '"', left(new.body, 200));
  return new;
end $$;
create trigger trg_comments_feed after insert on public.comments
  for each row execute function public.feed_on_activity_comment();

create or replace function public.feed_on_activity_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  if new.status is not distinct from old.status or auth.uid() is null then return new; end if;
  select display_name into who from profiles where id = auth.uid();
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
  values (new.trip_id, auth.uid(), 'booking', 'activity', new.id,
          coalesce(who, 'Admin') || ' changed "' || new.title || '" to ' || initcap(replace(new.status::text, '_', ' ')));
  return new;
end $$;
create trigger trg_activities_status_feed after update on public.itinerary_activities
  for each row execute function public.feed_on_activity_status();
