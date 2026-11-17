# Thailand Trip HQ

Private, realtime group workspace for five friends travelling to Thailand (28 Dec 2026 – 7 Jan 2027):
itinerary, checklists, document wallet, Splitwise-style expenses, social feed, polls, announcements.
React + TypeScript + Vite + Tailwind · Supabase (Auth, Postgres + RLS, Realtime, Storage) · GitHub Pages.
Multi-trip ready: all content is per-trip rows. See `docs/ARCHITECTURE.md` and `PROJECT_STATUS.md`.

## Setup (one-time, ~20 min)

### 1. Supabase project
1. Create a project at supabase.com (free tier is fine).
2. **SQL Editor**: run, in order, `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_storage_realtime.sql`, then `supabase/seed.sql`.
3. **Authentication → Providers → Email**: turn **off** "Allow new users to sign up"; set minimum password length 10.
4. **Project Settings → API**: copy the Project URL and the **anon** key (never the service_role key into the frontend).

### 2. Edge functions (username login + admin user management)
```bash
npm i -g supabase            # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy username-login --no-verify-jwt
supabase functions deploy admin-users
supabase secrets set ALLOWED_ORIGIN=https://<github-user>.github.io   # optional CORS lock-down
```

### 3. Create the five accounts
```bash
cp scripts/users.example.json scripts/users.json      # edit real names/usernames; first user = admin (gitignored)
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>   # Settings → API; only in your terminal
npm run provision
```
Random passwords are printed once. Share each privately; everyone can change theirs in **Profile**.
Later, the admin can add/reset/remove people via the `admin-users` function (Admin UI arrives in Phase 7).

### 4. Run locally
```bash
cp .env.example .env     # fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; set VITE_BASE=/ for local dev
npm install
npm run dev
```

### 5. Deploy to GitHub Pages
1. Create the GitHub repo, push `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Push to `main`; the workflow runs tests, builds with base `/<repo-name>/`, and deploys.

## Testing
| Command | What |
|---|---|
| `npm test` | Unit tests (helpers, later settlement maths) |
| `npm run test:db` | Applies the real migrations + seed to an in-process Postgres and runs 52 RLS/permission checks across 5 members, an outsider and anon |
| `npm run build` | Typecheck + production build + SPA fallback |

## Photos
No photos are bundled (licensing). Put image URLs/paths in `trips.hero_image_url` and `itinerary_days.image_url`
(`update itinerary_days set image_url='…' where city='Krabi';`) — the dashboard uses them automatically.

## Security notes
- Only the anon key is in the browser; service-role key is used only by edge functions / your local provisioning shell.
- Every table has RLS; storage buckets are private (signed URLs). Admin actions are enforced in the database/edge functions, not just hidden buttons.
- Usernames map to accounts server-side; passwords are random at provisioning and never in the repo.
