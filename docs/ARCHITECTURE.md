# Thailand Trip HQ — Architecture & Plan

## 1. Architecture

```
Browser (React 18 + TS + Vite + Tailwind, PWA)  ── GitHub Pages (static, base path /thailand-trip/)
   │  supabase-js (anon key only)
   ▼
Supabase
 ├─ Auth            email+password; users get a private real/synthetic email
 ├─ Postgres + RLS  single source of truth, every shared row has trip_id
 ├─ Realtime        postgres_changes on expenses, feed, comments, etc. (RLS-filtered)
 ├─ Storage         private buckets: documents, receipts, photos, avatars (signed URLs)
 └─ Edge Functions  username-login  (username -> session, service role server-side)
                    admin-users     (admin-only: create / reset / remove accounts)
```

Frontend layers: `lib/` (supabase client, pure logic such as settlement maths), `context/` (Auth, Trip),
`hooks/` (data + realtime), `components/ui` (design system), `components/layout`, `pages/`.

Multi-trip: every shared table carries `trip_id`; the app resolves a *current trip* from `trip_members`
(persisted preference only in localStorage). Nothing about Thailand is hard-coded; the trip, days,
activities, checklist and bookings are rows (see `supabase/seed.sql`, flagged as sample/initial data).

GitHub Pages: Vite `base` from `VITE_BASE`, `BrowserRouter basename`, `404.html` = copy of `index.html`
(SPA fallback), Workbox `navigateFallback` for offline.

## 2. Security model

* No public sign-up (`disable_signup`); accounts created only by `scripts/provision-users.mjs`
  (run locally with the service-role key from your shell) or the admin-only `admin-users` function.
* Passwords are generated randomly at provisioning and printed once; never committed.
* Login: user types username; `username-login` looks the account up with the service role and calls
  `signInWithPassword`; the browser receives only the session. Real emails never reach the client.
* Authorisation = RLS. Helper functions `is_trip_member(trip)` / `is_trip_admin(trip)` (SECURITY DEFINER,
  stable). Roles live in `trip_members.role` (never in a user-editable profile column).
* Personal data (checklist completions, personal expenses, notifications, announcement reads) is
  restricted to `user_id = auth.uid()`; admins can read checklist completions for progress, not write them.
* Storage policies mirror table policies via the `{trip_id}/…` path prefix.
* Only the anon key ships to the browser. Service-role key is used only in Edge Functions / local scripts.
* User text rendered by React (escaped by default); no `dangerouslySetInnerHTML`; URLs validated to http(s).

## 3. Schema (see `supabase/migrations/`)

trips, profiles, trip_members, itinerary_days, itinerary_activities, checklist_items, checklist_completions,
documents (with version chain `replaces_id`), accommodation_bookings, transport_bookings, activity_bookings,
expenses (+ expense_participants, expense_splits, expense_audit), settlements (idempotency key),
announcements, announcement_reads, activity_feed, comments, reactions, polls, poll_options, poll_votes,
notifications. UUID PKs, timestamps, CHECK constraints, soft delete (`deleted_at`) on user-authored data.

Currency rule: expenses store original amount + currency + `fx_rate_to_base` (rate used, editable per
expense) and `amount_base`. Currencies are never summed across without the stored rate.

## 4. Navigation

Mobile bottom bar: Home · Itinerary · Checklist · Wallet · Expenses · (More: Feed, Group, Admin).
Desktop: left sidebar with all 8 sections; Admin visible only to admins (and enforced by RLS).

## 5. Missing information (needs you)

Real names/usernames; flight numbers/airlines/terminals; hotel names/confirmations for Bangkok,
Phuket (Patong) and Sukhumvit 31; bus operator + times; activity operators/bookings; admin choice;
Supabase project credentials; GitHub repo name (affects `VITE_BASE`); Thai/INR rate you want as default;
photographs you have rights to use (placed in `public/images/`).

## 6. Phases

1 Foundation (schema, RLS, auth, login, shell, dashboard, PWA, CI) · 2 Itinerary & maps · 3 Checklists &
notifications · 4 Wallet, accommodation, transport · 5 Expenses · 6 Social · 7 Admin · 8 Test & deploy.
Progress tracked in `PROJECT_STATUS.md`.
