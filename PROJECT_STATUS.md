# PROJECT_STATUS

_Last updated: 2026-11-17_

## Phase 1 launch checklist (live environment)
- [x] 1. Project + README reviewed
- [x] 2. Secret scan clean; `.env`, `scripts/users.json` gitignored; nothing committed yet
- [x] 3. Supabase project `thailand-trip` created (ap-southeast-1); sign-ups disabled, min password 10
- [x] 4. Migrations 0001-0003 + seed applied; verified 1 trip / 11 days / 44 activities / 28 checklist items / 4 private buckets / 18 realtime tables
- [x] 5. Edge functions `username-login` (no JWT) and `admin-users` (JWT) deployed; smoke-tested (generic 401s)
- [x] 6. Five accounts provisioned (1 admin + 4 members; names and usernames kept out of the repo); passwords held by user only
- [x] 7. Local app against live backend: login, dashboard, Group, Profile confirmed working by user (as admin)
- [x] 8a. Permissions: a member account bounced from /admin, no Admin nav; Group lists all five (verified live)
- [x] 8b. Storage: member avatar upload visible to admin via signed URL (verified live)
- [ ] 8c. Realtime between two sessions: deferred until Phase 2 admin Edit exists (then a one-click test)
- [x] 9. Mobile test over LAN: runs on phone; Home not well optimised (user must zoom in/out to see some parts). Accepted for now; logged for the UI polish phase
- [ ] 10. GitHub Pages deploy + PWA verification
- [ ] Clean checkpoint commit, then Phase 2

## Phase 2 scope (agreed 2026-11-17)
Itinerary day strip + timeline; activity detail page; Directions + per-day multi-stop route links;
activity comments (own edit/delete, admin delete, realtime); realtime itinerary; admin "Edit activity" form
(status, time, notes, maps link, booking ref; add/delete/reorder stays in Phase 7); DB trigger writing
comment + status-change events to `activity_feed`.


## Phase 1 — Foundation  ✅ built, ⚠️ not yet run against a live Supabase project
**Done**
- Vite + React 18 + TS + Tailwind 3 + React Router (basename from `VITE_BASE`, `404.html` SPA fallback).
- PWA: manifest, icons, Workbox service worker (app shell only; API/storage responses are never cached).
- Full schema (25 tables), RLS on every table, private storage buckets + policies, realtime publication
  → `supabase/migrations/0001–0003`. Seed = initial Thailand data (`supabase/seed.sql`).
- Auth: username login via `username-login` edge function; `admin-users` function; `scripts/provision-users.mjs`.
- App shell (sidebar / bottom nav / More sheet), Login, Home dashboard (live data + realtime), Group, Profile
  (details, avatar upload, password change).
- CI: GitHub Actions deploy workflow (runs unit + DB tests first).

**Tests performed**
- `npm test` — 5 unit tests (dates, maps URLs, URL safety, route runs).
- `npm run test:db` — 52 RLS/permission assertions on the real migrations in an in-process Postgres (PGlite)
  with 5 member accounts + an outsider + anon (see `scripts/test-db.mjs`). Covers: cross-member isolation,
  admin-only writes, personal checklist/expenses/notifications, forged owner columns, single-choice polls,
  duplicate settlements, storage path policies.
- `tsc --noEmit` clean; production build succeeds.

**Not yet verified (needs your Supabase project)**
- Edge functions (written, not executed), real Realtime delivery, signed-URL avatars, live login, PWA install on a phone.
- No visual/browser QA done yet.

## Outstanding (next phases)
2 Itinerary pages, activity detail, maps, comments, admin editing · 3 Checklist UI + notifications ·
4 Wallet (upload/preview), accommodation/transport screens · 5 Expenses (+ settle algorithm w/ tests) ·
6 Feed, comments, reactions, polls, announcements UI, feed/notification triggers · 7 Admin panel · 8 E2E/mobile/PWA QA.
Placeholder routes currently render `ComingSoon`.

## Architecture decisions
- Roles live in `trip_members.role` (per trip), never in user-editable columns. Membership is service-role-only.
- Soft-deleted rows remain SELECT-able to members (clients filter `deleted_at`) so soft-delete UPDATEs pass RLS.
- Personal expenses are visible only to their creator (not even admin) and excluded from balances.
- Group checklist progress comes from `checklist_progress()` (SECURITY DEFINER, counts only); item-level
  completions are private to the user (+ admin read).
- Expenses store original amount + currency + the FX rate used + `amount_base`; currencies are never summed raw.
- System feed events and notifications will be written by SECURITY DEFINER triggers (Phase 3/6); clients can
  only insert `post`/`photo` feed rows.
- Account email is synthetic (`<username>@thailand-trip.example.com`) unless an email is supplied.

## Known issues / risks
- `default_thb_to_inr = 2.5` is a placeholder; set the real rate in trip settings (Phase 7).
- Destination photos: none bundled (rights). Add URLs to `itinerary_days.image_url` / `trips.hero_image_url`
  (Admin in Phase 7, or SQL) — gradients are used until then.
- No password-reset email flow (accounts have no real inbox): admin resets via `admin-users` (UI in Phase 7).
- `username-login` has no app-level rate limit beyond Supabase Auth's own.
- Main JS bundle ~527 kB (153 kB gzip); code-split per route in Phase 8.

## Added phase: UI Polish ("world class" pass), scheduled after core features
- Mobile Home: investigate horizontal overflow / fit (user has to zoom); tune hero, route chips, cards at 360-430px.
- Real destination photography, typography, motion, empty/loading states, tablet and desktop layouts, accessibility audit.
