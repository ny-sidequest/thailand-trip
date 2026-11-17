-- Phase 4: Travel Wallet. Per-document visibility, version-safe inserts, storage rules that follow the
-- documents table, upload feed/notifications, and wider activity-edit notifications.

alter table public.documents
  add column visibility text not null default 'group' check (visibility in ('group','private'));

-- ---------- documents RLS (replaces Phase 1 policies) ----------
drop policy docs_select on public.documents;
drop policy docs_insert on public.documents;
drop policy docs_update on public.documents;

-- 'private' documents are visible to the uploader ONLY (not even the admin)
create policy docs_select on public.documents for select to authenticated
  using (is_trip_member(trip_id) and (visibility = 'group' or uploaded_by = auth.uid()));

create policy docs_insert on public.documents for insert to authenticated
  with check (
    is_trip_member(trip_id) and uploaded_by = auth.uid()
    and (traveller_id is null or is_member_of(trip_id, traveller_id))
    -- a new version may only replace a document you own, or any group document if you are admin
    and (replaces_id is null or exists (
      select 1 from public.documents o
      where o.id = documents.replaces_id and o.trip_id = documents.trip_id
        and (o.uploaded_by = auth.uid() or (is_trip_admin(o.trip_id) and o.visibility = 'group')))));

create policy docs_update on public.documents for update to authenticated
  using (is_trip_member(trip_id) and (uploaded_by = auth.uid() or (is_trip_admin(trip_id) and visibility = 'group')))
  with check (is_trip_member(trip_id) and (uploaded_by = auth.uid() or (is_trip_admin(trip_id) and visibility = 'group')));

-- ---------- storage: the documents bucket follows the documents table ----------
drop policy "documents_read" on storage.objects;
drop policy "documents_update" on storage.objects;
drop policy "documents_delete" on storage.objects;

-- readable if you uploaded it, or you can see its documents row (RLS applies inside this subquery)
create policy "documents_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
    and public.is_trip_member(((storage.foldername(name))[1])::uuid)
    and (owner = auth.uid() or exists (select 1 from public.documents d where d.storage_path = storage.objects.name)));
create policy "documents_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or (
    public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name))));
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (owner = auth.uid() or (
    public.is_trip_admin(((storage.foldername(name))[1])::uuid)
    and exists (select 1 from public.documents d where d.storage_path = storage.objects.name))));

update storage.buckets set allowed_mime_types = array[
  'application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'] where id = 'documents';

-- ---------- feed + notifications for shared uploads ----------
create or replace function public.feed_notify_on_document() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; msg text;
begin
  if new.visibility <> 'group' then return new; end if;
  select display_name into who from profiles where id = new.uploaded_by;
  msg := who || case when new.replaces_id is null then ' uploaded "' else ' uploaded a new version of "' end || new.name || '"';
  insert into activity_feed (trip_id, actor_id, verb, entity_type, entity_id, summary)
  values (new.trip_id, new.uploaded_by, 'document', 'document', new.id, msg);
  perform notify_members(new.trip_id, new.uploaded_by, 'document', msg, null, '/wallet');
  return new;
end $$;
create trigger trg_documents_feed after insert on public.documents
  for each row execute function public.feed_notify_on_document();

-- ---------- activity edits: notify on status OR time / location / meeting-point changes ----------
create or replace function public.notify_on_activity_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare changed text[] := '{}'; title text; body text;
begin
  if (new.start_time, new.end_time, new.time_note) is distinct from (old.start_time, old.end_time, old.time_note) then
    changed := array_append(changed, 'time'); end if;
  if (new.location_name, new.maps_url) is distinct from (old.location_name, old.maps_url) then
    changed := array_append(changed, 'location'); end if;
  if (new.meeting_point, new.pickup_info) is distinct from (old.meeting_point, old.pickup_info) then
    changed := array_append(changed, 'meeting point'); end if;

  if new.status is distinct from old.status then
    title := new.title || ' is now ' || initcap(replace(new.status::text, '_', ' '));
    if array_length(changed, 1) > 0 then body := 'Also changed: ' || array_to_string(changed, ', '); end if;
  elsif array_length(changed, 1) > 0 then
    title := new.title || ' was updated';
    body := 'Changed: ' || array_to_string(changed, ', ');
  else
    return new;
  end if;
  perform notify_members(new.trip_id, auth.uid(), 'booking', title, body, '/itinerary/activity/' || new.id);
  return new;
end $$;
