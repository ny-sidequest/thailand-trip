-- Private buckets. Object path convention: <trip_id>/<...> (avatars: <user_id>/<...>).
insert into storage.buckets (id, name, public, file_size_limit) values
  ('documents', 'documents', false, 20971520),
  ('receipts',  'receipts',  false, 10485760),
  ('photos',    'photos',    false, 15728640),
  ('avatars',   'avatars',   false, 3145728)
on conflict (id) do update set public = false;

-- trip-scoped buckets: any trip member reads/uploads; only uploader (owner) or admin changes/deletes
do $$
declare b text;
begin
  foreach b in array array['documents','receipts','photos'] loop
    execute format($f$create policy "%1$s_read" on storage.objects for select to authenticated
      using (bucket_id = %1$L and public.is_trip_member(((storage.foldername(name))[1])::uuid))$f$, b);
    execute format($f$create policy "%1$s_insert" on storage.objects for insert to authenticated
      with check (bucket_id = %1$L and public.is_trip_member(((storage.foldername(name))[1])::uuid))$f$, b);
    execute format($f$create policy "%1$s_update" on storage.objects for update to authenticated
      using (bucket_id = %1$L and (owner = auth.uid() or public.is_trip_admin(((storage.foldername(name))[1])::uuid)))$f$, b);
    execute format($f$create policy "%1$s_delete" on storage.objects for delete to authenticated
      using (bucket_id = %1$L and (owner = auth.uid() or public.is_trip_admin(((storage.foldername(name))[1])::uuid)))$f$, b);
  end loop;
end $$;

-- avatars: own folder write, readable by people who share a trip with the owner
create policy "avatars_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.shares_trip_with(((storage.foldername(name))[1])::uuid)));
create policy "avatars_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime (postgres_changes honours RLS, so members only receive rows they may read)
alter table public.expenses replica identity full;
alter publication supabase_realtime add table
  public.itinerary_days, public.itinerary_activities, public.checklist_completions, public.checklist_items,
  public.documents, public.accommodation_bookings, public.transport_bookings, public.activity_bookings,
  public.expenses, public.expense_splits, public.settlements, public.announcements,
  public.activity_feed, public.comments, public.reactions, public.polls, public.poll_votes,
  public.notifications;
