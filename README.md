# Thailand Trip HQ

A private, realtime workspace for a group trip: shared itinerary, personal checklists, document wallet,
Splitwise-style expenses, social feed, polls and announcements, with an admin panel.

**Stack:** React + TypeScript + Vite + Tailwind (PWA) · Supabase (Auth, Postgres + RLS, Realtime, Storage, Edge
Functions) · GitHub Pages + GitHub Actions. Everything is stored per trip (`trip_id`), so the app is reusable for
future trips. See `docs/ARCHITECTURE.md`, `docs/ADMIN_GUIDE.md`, `docs/TEST_PLAN.md`, `PROJECT_STATUS.md`.

## Features
Home dashboard · Itinerary (days, activities, Google Maps directions, comments, reactions) · Checklist (personal
progress, group totals, deadlines) · Travel Wallet (private documents with versions, per-document privacy, stays,
transport) · Expenses (THB/INR with a stored rate per expense, equal / amount / percentage splits, receipts,
minimum-transfer settlement suggestions, audit trail, personal expenses) · Feed (posts, photos, reactions, comments) ·
Polls · Announcements with read receipts · Notifications · Admin panel · Installable PWA.

Design: dark glass theme, Outfit + Inter fonts bundled with the app (no external font requests), hand-drawn destination art,
a journey map on Home that follows the trip dates.

## Setup (one time, about 20 minutes)

### 1. Supabase project
1. Create a project at supabase.com (free tier is fine).
2. **SQL Editor → New query**: run each file below, **in order, one at a time**, in a fresh query each time, and
   confirm "Success" before the next:
   `supabase/migrations/0001_schema.sql` … `0010_security_hardening.sql`, then `supabase/seed.sql`
   (seed = the initial Thailand itinerary; skip it for a blank trip).
3. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up"; minimum password length `10`;
   turn **on** "Secure password change" (requires a recent sign-in before a password can be changed).
4. **Project Settings → API**: copy the Project URL and the **anon** key. Never put the `service_role` key in the
   frontend, the repo, or a `VITE_` variable.

Verify the migrations applied (all should be non-zero / listed):
```sql
select count(*) from information_schema.columns where table_name='documents' and column_name='visibility';  -- 0006
select count(*) from pg_proc where proname in ('save_expense','delete_expense');                            -- 0007 (=2)
select count(*) from pg_proc where proname in ('create_poll','set_poll_votes');                             -- 0008 (=2)
select count(*) from pg_proc where proname in ('reorder_activities','delete_day');                         -- 0009 (=2)
select count(*) from pg_proc where proname in ('record_settlement','delete_settlement','normalize_fx');       -- 0010 (=3)
```

### 2. Edge functions (username login + admin user management)
```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy username-login --no-verify-jwt
npx supabase functions deploy admin-users
npx supabase secrets set ALLOWED_ORIGIN=https://<github-user>.github.io      # restricts CORS (recommended)
```

### 3. Create the accounts
```bash
cp scripts/users.example.json scripts/users.json     # edit names / usernames; first admin = "admin" (file is gitignored)
export SUPABASE_URL=https://<ref>.supabase.co
read -s "SUPABASE_SERVICE_ROLE_KEY?service role key: " && export SUPABASE_SERVICE_ROLE_KEY
npm run provision
```
Run this in your own terminal. Random passwords are printed once; store them in a password manager and share each
one privately. Usernames: 3-30 characters of `a-z 0-9 _ .`. Everyone can change their password under **Profile**.
Existing accounts created before the security pass have predictable sign-in emails; run `node scripts/rotate-emails.mjs`
(same environment variables) once to replace them with random ones. Usernames and passwords are unaffected.
Later, the admin can add / reset / promote / remove people in **Admin → People & access** (no terminal needed).

### 4. Run locally
```bash
cp .env.example .env        # set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY; VITE_BASE=/ for local dev
npm run dev
```

### 5. Deploy to GitHub Pages
1. Push the repo to GitHub (public repos get Pages on the free plan).
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (public values; RLS protects the data).
4. Push to `main`. The workflow runs the tests, builds with base `/<repo>/`, and deploys.
   Open the site on a phone and use **Add to Home Screen** to install it.

## Testing
| Command | What it checks |
|---|---|
| `npm test` | Unit tests: money and settlement maths (exact minimum-transfer solver, split rounding), dates, maps links, documents, social logic |
| `npm run test:db` | Applies the real migrations + seed to an in-process Postgres and runs the RLS / function / trigger assertions across 5 members, an outsider and anon |
| `npm run build` | Typecheck, production build, SPA fallback (`404.html`), service worker |
| `docs/TEST_PLAN.md` | Manual two-account checks to run against the live project |

## Security model (short)
Independently audited; findings and fixes are in `docs/SECURITY_AUDIT.md`.
- No public sign-up. Accounts are created by `scripts/provision-users.mjs` or the admin-only `admin-users` function.
- Users sign in with a username; the `username-login` function maps it to the account server-side and returns a session.
- The browser only ever has the anon key. The service-role key exists only in Edge Functions and your own terminal.
- Row Level Security is enabled on every table. Roles live in `trip_members` (service-role-written only).
- Expenses, polls, reordering and day deletion are written only through validated `SECURITY DEFINER` functions.
- Documents and receipts are in private buckets, opened with short-lived signed URLs. "Only me" documents and personal
  expenses are invisible to everyone else, including the admin, at the table and storage level.
- Private data is never cached by the service worker (only the app shell is).

## Reusing for another trip
All content is per trip, so nothing needs rebuilding. To start a new one:
1. SQL Editor: `insert into trips (name, slug, start_date, end_date, base_currency) values ('Goa 2027', 'goa-2027', '2027-03-01', '2027-03-05', 'INR');`
2. People: new accounts via `scripts/users.json` (set `trip_slug` to the new slug) + `npm run provision`. Existing accounts are
   skipped by the script; add them to the new trip with
   `insert into trip_members (trip_id, user_id, role) select t.id, p.id, 'member' from trips t, profiles p where t.slug='goa-2027' and p.username in ('...');`
3. Fill the itinerary, bookings and checklist in **Admin**.

Known limitation: the app currently opens the first trip a person belongs to. A trip switcher (the data layer already
supports several trips) is a small follow-up if you need two trips live at once.

## Photos
No photos are bundled (licensing). Add https links in **Admin → Trip settings** (hero image) and per day in
**Admin → Itinerary → edit day → Photo link**. Gradients are used until then.
