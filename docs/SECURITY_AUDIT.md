# Security audit (Phase 8)

An independent Opus review of every migration, both Edge Functions, the provisioning scripts and the frontend.
Every claim was reproduced by me with a failing regression test in `scripts/test-db.mjs` before being fixed
(migration `0010_security_hardening.sql`). 159 database assertions now pass, including all of the below.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | High | A member could rewrite their own settlement (amount, rate, parties) | **Fixed.** Direct writes revoked; `record_settlement` / `delete_settlement` validate everything; soft delete is audited in the feed |
| 2 | High | Unbounded exchange rate on settlements (credit for INR 1 → INR 999,999) | **Fixed.** Base-currency rate forced to 1; other rates bounded to 50-200 % of the trip default |
| 3 | High | Forged "pointer" rows exposed other members' private documents / receipts and let an admin delete private files | **Fixed.** Document paths bound to `<trip>/<doc id>/` and immutable; receipts bound to `<trip>/<expense id>/`; storage policies also require the row's uploader to be the object's owner |
| 4 | Medium | `save_expense` accepted any FX rate up to 100000 | **Fixed** (same bound). Notifications now also show the converted amount |
| 5 | Medium | `username-login`: username enumeration by timing, no app-level rate limit, predictable sign-in emails | **Partly fixed.** New accounts get random emails; `scripts/rotate-emails.mjs` rotates the existing ones. Not added: custom throttling (it would let anyone lock a friend out); Supabase Auth's built-in rate limits apply. Accepted risk: usernames of a 5-person private group are low-secrecy and passwords are 16 random characters |
| 6 | Low | Members could rewrite the verb / summary of their own feed events and move comments between targets | **Fixed.** Column-level update grants (`deleted_at`, and `body` for comments); also locked documents' `replaces_id` and friends |
| 7 | Low | Membership helper functions callable by anon (membership oracle) | **Fixed.** Execute revoked from `public` / `anon` |
| 8 | Low | Current-password check on password change is client-side only | **Mitigation, manual:** enable Auth → Providers → Email → *Secure password change* (requires a recent sign-in). See README |
| 9 | Low | No CSP; CORS `*` when `ALLOWED_ORIGIN` unset; no MIME limits on photos / avatars; DELETE realtime events bypass RLS (checklist untick leaks who unticked what); `remove_member` leaves the auth user | **CSP added** (production build, restricted to the Supabase origin). **MIME limits added.** **Checklist completions removed from realtime**; a content-free `checklist_pings` table drives live progress. CORS: tokens are bearer headers (no cookies), so `*` is not an auth boundary; set `ALLOWED_ORIGIN` anyway. `remove_member`: RLS already cuts all data access; the auth user remains (documented) |

## Checked and found sound
Admin escalation (trip_members write-revoked; admin-users checks the caller's role server-side) · cross-trip access
(every policy pins `trip_id`; trip_id immutable) · personal expenses and audit rows hidden · expense RPC validation
(sums, duplicates, membership, NaN / Infinity / extra decimals) · notifications (own rows, `read_at` only) · checklist
and read-receipt privacy · poll RPCs · storage folder casting · avatar folder isolation · `admin-users` scoping,
no self-demotion, password entropy (~92 bits) · no `dangerouslySetInnerHTML`; URLs pass `safeUrl`; notification links
accept only `/` paths · filenames sanitised · service worker never caches Supabase responses · no secrets committed.

## Residual risks (accepted)
- A stolen device with a live session can change that account's password (see #8; reduced by Secure password change).
- Supabase Auth, not this app, rate-limits password guessing.
- Admin-entered image links can load from any https host (CSP `img-src https:`); admins are trusted.
