-- Destination guide: shared reference content (tips, how-tos, places) per trip.
-- Members read; admins create/edit. No hard deletes (soft delete via deleted_at).
-- Photos are static files shipped with the app (public/guide/*.webp), referenced by relative path.

create table if not exists public.guide_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null check (category in ('before','airport','getting-around','places','essentials','safety')),
  city text not null default 'Everywhere' check (char_length(city) between 1 and 40),
  title text not null check (char_length(title) between 1 and 160),
  summary text not null default '' check (char_length(summary) <= 300),
  body text not null default '' check (char_length(body) <= 8000),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  day_numbers int[] not null default '{}',
  pinned boolean not null default false,
  sort_order int not null default 0,
  photo_path text check (photo_path is null or photo_path ~ '^guide/[a-z0-9-]+\.webp$'),
  photo_credit text check (char_length(photo_credit) <= 160),
  photo_license text check (char_length(photo_license) <= 40),
  photo_license_url text check (photo_license_url is null or photo_license_url ~ '^https://'),
  photo_source_url text check (photo_source_url is null or photo_source_url ~ '^https://'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists guide_items_trip_idx on public.guide_items (trip_id, category, sort_order) where deleted_at is null;

alter table public.guide_items enable row level security;
revoke all on public.guide_items from anon;

create policy guide_items_select on public.guide_items for select to authenticated using (is_trip_member(trip_id));
create policy guide_items_admin_ins on public.guide_items for insert to authenticated
  with check (is_trip_admin(trip_id) and (created_by is null or created_by = auth.uid()));
create policy guide_items_admin_upd on public.guide_items for update to authenticated
  using (is_trip_admin(trip_id)) with check (is_trip_admin(trip_id));
-- no delete policy: items are soft-deleted (deleted_at)

-- every link must be https (checked here because CHECK cannot use subqueries)
create or replace function public.guide_items_validate() returns trigger
language plpgsql as $$
declare l jsonb;
begin
  for l in select * from jsonb_array_elements(new.links) loop
    if jsonb_typeof(l) <> 'object' or coalesce(l->>'url','') !~ '^https://' or char_length(coalesce(l->>'label','')) not between 1 and 120
       or char_length(l->>'url') > 500 then
      raise exception 'Each link needs a label and an https url' using errcode = '23514';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guide_items_validate before insert or update on public.guide_items
  for each row execute function public.guide_items_validate();
create trigger trg_guide_items_lock before update on public.guide_items
  for each row execute function public.lock_owner_columns();

alter publication supabase_realtime add table public.guide_items;
