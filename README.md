# Pawprint 🐾

A pet health record app built to dogfood **Supabase Auth, Edge Functions, Branching, and Storage**.

Pet parents can track growth, vaccinations, surgeries and illnesses, food, and DNA results; upload photos and documents; share files by temporary link; and find vets nearby.

## What uses what

| Feature | Supabase piece |
|---|---|
| Email/password + magic-link sign-in, profile created on sign-up | **Auth** (+ `handle_new_user` trigger) |
| Everything private to its owner | **RLS** policies in `supabase/migrations/…init_schema.sql` |
| Photo and document uploads, thumbnails, deletes | **Storage** (`pet-photos`, `pet-documents`, policies in `…_storage.sql`) |
| Temporary share links for a file | **Edge Function** `share-link` (runs as the caller, so RLS applies) |
| Vet search (OpenStreetMap, no API key) | **Edge Function** `vet-search` |
| Daily vaccine-due emails | **Edge Function** `vaccine-reminders` + `pg_cron` |
| Safe schema changes, demo data per branch | **Branching** (`seed.sql`, GitHub integration, CI) |

## Run it locally

Prereqs: Node 20+, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
supabase start                      # prints API URL + keys
cp .env.example .env                # paste the URL and anon/publishable key
supabase db reset                   # applies migrations + seed.sql
npm run dev                         # http://localhost:5173
```

Sign in with the demo account `demo@pawprint.test` / `password123`, or create your own.

Edge Functions (in a second terminal):

```bash
cp supabase/functions/.env.example supabase/functions/.env
supabase functions serve --env-file supabase/functions/.env
```

Test the reminder function by hand:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/vaccine-reminders -H "x-cron-secret: change-me"
```

Run the RLS tests: `supabase test db`

## Set up Branching

Branching creates an isolated Supabase environment for every pull request. It needs a hosted project, a GitHub repo, and a plan that includes Branching (check current pricing).

1. **Create the project** at supabase.com, then link and push:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   supabase functions deploy
   supabase secrets set CRON_SECRET=<long-random-string>
   ```
2. **Push this repo to GitHub** with `main` as the production branch.
3. In the dashboard: **Project Settings → Integrations → GitHub**. Connect the repo, set the Supabase directory to `.`, and turn on "Deploy to production" so merges to `main` run migrations.
4. **Enable Branching** (Dashboard → Branches).
5. **Try the loop:**
   ```bash
   git checkout -b feature/medications
   supabase migration new add_medications     # edit the generated SQL file
   supabase db reset                          # test locally
   git add . && git commit -m "Add medications" && git push -u origin feature/medications
   ```
   Open a pull request. Supabase creates a preview branch, runs all migrations, runs `seed.sql`, and deploys the functions. Grab the branch URL and keys from the branch selector in the dashboard and point a preview deployment of the frontend at them. Merge the PR and the migration runs on production.

Things to know (and worth writing up in `DOGFOOD.md`):
- Preview branches get **schema and seed data, not production data**. Storage buckets exist because they are created in a migration; uploaded files do not carry over.
- **Secrets are per branch.** Set `CRON_SECRET` etc. on a branch if you want to test `vaccine-reminders` there.
- The reminder **cron job is not a migration** on purpose. See `supabase/snippets/schedule-reminders.sql`. Run it once on production.
- `seed.sql` creates a demo user. Don't let it near production; it only runs on local resets and branches.

## Project layout

```
supabase/
  config.toml                 auth, storage, function settings, seed path
  migrations/                 schema + RLS, buckets + storage policies
  functions/                  vet-search, share-link, vaccine-reminders, _shared
  snippets/                   one-time SQL (cron)
  tests/rls.test.sql          pgTAP tests
  seed.sql                    demo data for local + preview branches
src/                          Vite + React app
.github/workflows/ci.yml      lint, RLS tests, build on every PR
DOGFOOD.md                    friction log: the real deliverable
```

## Ideas for next steps

Each is a good excuse to exercise a different feature:

- **Medications and refills** table with reminders (new migration → try Branching).
- **Family sharing**: invite another user to a pet (rewrite RLS around a `pet_members` table).
- **Realtime**: live updates when a partner logs a walk or meal.
- **Image transformations** for photo thumbnails instead of loading full-size files.
- **Resumable uploads** for big DNA raw-data ZIPs from your phone.
- **Search your records** with Postgres full-text search, or pgvector for "when was the last ear infection?"
- **Storage cleanup**: a database webhook or scheduled function that removes files whose pet was deleted.
- **OAuth** (Google/Apple) and a PWA install prompt.
- **Expense tracking** using `cost_cents` on medical events.

## Not verified yet

This was scaffolded without network access, so I haven't run `npm install`, `npm run build`, or `supabase start`. Expect to fix a few small things on first run, and log them in `DOGFOOD.md`.
