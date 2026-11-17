-- Thailand Trip HQ — core schema. Every shared row carries trip_id.
create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- trips & people ----------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  tagline text,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'Asia/Bangkok',
  base_currency text not null default 'INR' check (base_currency in ('INR','THB')),
  default_thb_to_inr numeric(10,4) not null default 2.5 check (default_thb_to_inr > 0),
  hero_image_url text,
  route_stops text[] not null default '{}',   -- ordered overview, e.g. Bangalore, Bangkok, Phuket…
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date >= start_date)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path text,
  phone text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index on public.trip_members (user_id);

-- ---------- itinerary ----------
create type public.booking_status as enum
  ('confirmed','pending','suggested','needs_verification','cancelled','completed');

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number int not null check (day_number > 0),
  day_date date not null,
  city text not null,
  title text not null,
  summary text,
  image_url text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (trip_id, day_number)
);
create index on public.itinerary_days (trip_id, day_date);

create table public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid not null references public.itinerary_days(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  kind text not null default 'activity'
    check (kind in ('activity','food','transport','stay','flight','option','free')),
  start_time time,                 -- null = unknown / unconfirmed
  end_time time,
  time_note text,                  -- e.g. "approx 17:00-17:30 (unconfirmed)"
  duration_text text,
  location_name text,
  origin text,
  destination text,
  maps_url text check (maps_url is null or maps_url ~* '^https?://'),
  meeting_point text,
  pickup_info text,
  transport_info text,
  est_cost_amount numeric(12,2) check (est_cost_amount is null or est_cost_amount >= 0),
  est_cost_currency text check (est_cost_currency in ('THB','INR')),
  reminders text,
  status public.booking_status not null default 'suggested',
  booking_ref text,
  is_optional boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.itinerary_activities (trip_id, day_id, sort_order);

-- ---------- checklists ----------
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  due_date date,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.checklist_items (trip_id, category, sort_order);

create table public.checklist_completions (
  item_id uuid not null references public.checklist_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index on public.checklist_completions (trip_id, user_id);

-- ---------- bookings ----------
create table public.accommodation_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  city text,
  address text,
  check_in date,
  check_out date,
  confirmation_ref text,
  contact text,
  checkin_instructions text,
  maps_url text check (maps_url is null or maps_url ~* '^https?://'),
  notes text,
  status public.booking_status not null default 'pending',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (check_out is null or check_in is null or check_out >= check_in)
);
create index on public.accommodation_bookings (trip_id, check_in);

create table public.transport_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  mode text not null check (mode in ('flight','bus','ferry','speedboat','taxi','train','other')),
  operator text,
  origin text not null,
  destination text not null,
  travel_date date,
  departure_time time,
  arrival_time time,
  time_note text,
  booking_ref text,
  meeting_point text,
  luggage_notes text,
  maps_url text check (maps_url is null or maps_url ~* '^https?://'),
  notes text,
  status public.booking_status not null default 'pending',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.transport_bookings (trip_id, travel_date);

create table public.activity_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.itinerary_activities(id) on delete set null,
  name text not null,
  operator text,
  booking_date date,
  start_time time,
  booking_ref text,
  meeting_point text,
  pickup_info text,
  price_amount numeric(12,2) check (price_amount is null or price_amount >= 0),
  price_currency text check (price_currency in ('THB','INR')),
  contact text,
  notes text,
  status public.booking_status not null default 'pending',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.activity_bookings (trip_id, booking_date);

-- ---------- documents ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  category text not null check (category in
    ('flight','hotel','hostel','bus','ferry','activity','insurance','entry','emergency','misc')),
  related_date date,
  related_booking_type text check (related_booking_type in ('accommodation','transport','activity')),
  related_booking_id uuid,
  traveller_id uuid references public.profiles(id),
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  notes text,
  version int not null default 1,
  replaces_id uuid references public.documents(id),   -- version chain
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.documents (trip_id, category);

-- ---------- expenses ----------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 160),
  category text not null default 'other',
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('THB','INR')),
  fx_rate_to_base numeric(12,6) not null default 1 check (fx_rate_to_base > 0), -- rate used at entry
  amount_base numeric(12,2) not null check (amount_base > 0),
  expense_date date not null default current_date,
  payer_id uuid not null references public.profiles(id),
  split_type text not null default 'equal' check (split_type in ('equal','custom','percentage')),
  is_personal boolean not null default false,
  receipt_path text,
  notes text,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.expenses (trip_id, expense_date desc);
create index on public.expenses (payer_id);

create table public.expense_participants (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  trip_id uuid not null references public.trips(id) on delete cascade,
  primary key (expense_id, user_id)
);

create table public.expense_splits (        -- computed share in ORIGINAL currency
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  trip_id uuid not null references public.trips(id) on delete cascade,
  share_amount numeric(12,2) not null check (share_amount >= 0),
  percentage numeric(6,3) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  primary key (expense_id, user_id)
);

create table public.expense_audit (
  id bigint generated always as identity primary key,
  expense_id uuid not null,
  trip_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_row jsonb,
  new_row jsonb
);
create index on public.expense_audit (expense_id, changed_at);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency in ('THB','INR')),
  fx_rate_to_base numeric(12,6) not null default 1 check (fx_rate_to_base > 0),
  note text,
  settled_on date not null default current_date,
  idempotency_key uuid not null,             -- client generated; blocks double-submits
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_user <> to_user),
  unique (trip_id, idempotency_key)
);
create index on public.settlements (trip_id, settled_on desc);

-- ---------- social ----------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null,
  importance text not null default 'normal' check (importance in ('normal','important','urgent')),
  pinned boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.announcements (trip_id, created_at desc);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  verb text not null check (verb in
    ('post','photo','document','expense','settlement','checklist','booking','itinerary','announcement','poll','comment')),
  entity_type text,
  entity_id uuid,
  summary text not null,
  body text check (body is null or char_length(body) <= 4000),
  photo_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.activity_feed (trip_id, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  target_type text not null check (target_type in ('activity','feed','announcement','poll','document','expense')),
  target_id uuid not null,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.comments (trip_id, target_type, target_id, created_at);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  target_type text not null check (target_type in ('activity','feed','announcement','comment','poll')),
  target_id uuid not null,
  user_id uuid not null references public.profiles(id),
  emoji text not null check (emoji in ('👍','❤️','😂','🔥','🎉','😮')),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id, emoji)
);
create index on public.reactions (trip_id, target_type, target_id);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  multiple_choice boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.polls (trip_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  sort_order int not null default 0
);
create index on public.poll_options (poll_id);

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, user_id)
);
create index on public.poll_votes (poll_id, user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['trips','profiles','itinerary_days','itinerary_activities','checklist_items',
    'accommodation_bookings','transport_bookings','activity_bookings','documents','expenses',
    'announcements','comments'] loop
    execute format('create trigger trg_%s_updated before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- expense audit trail ----------
create or replace function public.audit_expense() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into expense_audit(expense_id, trip_id, action, changed_by, new_row)
      values (new.id, new.trip_id, 'insert', auth.uid(), to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    insert into expense_audit(expense_id, trip_id, action, changed_by, old_row, new_row)
      values (new.id, new.trip_id,
        case when new.deleted_at is not null and old.deleted_at is null then 'delete' else 'update' end,
        auth.uid(), to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end $$;
create trigger trg_expenses_audit after insert or update on public.expenses
  for each row execute function public.audit_expense();
