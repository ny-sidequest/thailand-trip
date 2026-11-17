-- Phase 6: polls (atomic create + vote), announcement feed events, feed-post comment notifications.

create or replace function public.create_poll(
  p_trip uuid, p_question text, p_multiple boolean, p_closes timestamptz, p_options text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_id uuid; q text := btrim(coalesce(p_question, '')); opts text[]; who text; i int;
begin
  if uid is null or not is_trip_admin(p_trip) then raise exception 'Only the trip admin can create polls' using errcode = '42501'; end if;
  if char_length(q) not between 1 and 200 then raise exception 'Question must be 1-200 characters'; end if;
  select array_agg(btrim(o) order by ord) into opts from unnest(p_options) with ordinality as t(o, ord) where btrim(o) <> '';
  if opts is null or array_length(opts, 1) not between 2 and 10 then raise exception 'A poll needs 2 to 10 options'; end if;
  if (select count(distinct lower(o)) from unnest(opts) o) <> array_length(opts, 1) then raise exception 'Options must be different'; end if;
  if exists (select 1 from unnest(opts) o where char_length(o) > 160) then raise exception 'Option text is too long'; end if;
  if p_closes is not null and p_closes <= now() then raise exception 'Closing time must be in the future'; end if;

  insert into polls (trip_id, question, multiple_choice, closes_at, created_by)
    values (p_trip, q, coalesce(p_multiple, false), p_closes, uid) returning id into v_id;
  for i in 1..array_length(opts, 1) loop
    insert into poll_options (poll_id, trip_id, label, sort_order) values (v_id, p_trip, opts[i], i);
  end loop;

  select display_name into who from profiles where id = uid;
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
    values (p_trip, uid, 'poll', 'poll', v_id, who || ' started a poll: ' || q);
  perform notify_members(p_trip, uid, 'poll', 'New poll: ' || q, null, '/feed/polls');
  return v_id;
end $$;

-- Replace the caller's votes on a poll in one atomic step (empty array clears them).
create or replace function public.set_poll_votes(p_poll uuid, p_options uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p polls%rowtype; n int := coalesce(array_length(p_options, 1), 0);
begin
  if uid is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select * into p from polls where id = p_poll and deleted_at is null;
  if not found or not is_trip_member(p.trip_id) then raise exception 'Poll not found'; end if;
  if p.closed_at is not null or (p.closes_at is not null and p.closes_at <= now()) then raise exception 'This poll is closed'; end if;
  if n > 0 and (select count(distinct o) from unnest(p_options) o) <> n then raise exception 'Duplicate options'; end if;
  if n > 1 and not p.multiple_choice then raise exception 'This poll allows only one choice'; end if;
  if (select count(*) from poll_options where poll_id = p_poll and id = any (p_options)) <> n then
    raise exception 'Option does not belong to this poll'; end if;
  delete from poll_votes where poll_id = p_poll and user_id = uid;
  insert into poll_votes (poll_id, option_id, user_id, trip_id) select p_poll, o, uid, p.trip_id from unnest(p_options) o;
end $$;

revoke all on function public.create_poll(uuid, text, boolean, timestamptz, text[]), public.set_poll_votes(uuid, uuid[]) from public, anon;
grant execute on function public.create_poll(uuid, text, boolean, timestamptz, text[]), public.set_poll_votes(uuid, uuid[]) to authenticated;

-- ---------- announcement -> feed event ----------
create or replace function public.feed_on_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text;
begin
  select display_name into who from profiles where id = new.created_by;
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
    values (new.trip_id, new.created_by, 'announcement', 'announcement', new.id, coalesce(who, 'Admin') || ' posted an announcement: ' || new.title);
  return new;
end $$;
create trigger trg_announcements_feed after insert on public.announcements
  for each row execute function public.feed_on_announcement();

-- ---------- comments on feed posts -> notify the post's author + earlier commenters ----------
create or replace function public.notify_on_feed_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; post_actor uuid;
begin
  if new.target_type <> 'feed' then return new; end if;
  select actor_id into post_actor from activity_feed where id = new.target_id and trip_id = new.trip_id;
  select display_name into who from profiles where id = new.author_id;
  insert into notifications (trip_id, user_id, type, title, body, link)
  select distinct new.trip_id, u, 'comment', who || ' commented on a post', left(new.body, 160), '/feed'
  from (select post_actor as u
        union select c.author_id from comments c
          where c.trip_id = new.trip_id and c.target_type = 'feed' and c.target_id = new.target_id and c.deleted_at is null) x
  where u is not null and u <> new.author_id and is_member_of(new.trip_id, u);
  return new;
end $$;
create trigger trg_comments_feed_notify after insert on public.comments
  for each row execute function public.notify_on_feed_comment();

-- announcement notifications should open the announcements tab (0005 linked to '/')
create or replace function public.notify_on_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_members(new.trip_id, new.created_by, 'announcement',
    case new.importance when 'urgent' then 'Urgent: ' || new.title else new.title end,
    left(new.body, 160), '/feed/announcements');
  return new;
end $$;
