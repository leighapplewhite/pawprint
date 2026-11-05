# Dogfooding log

Every time Supabase surprises, delights, or blocks you while building Pawprint, add a row.
This is the whole point of the project; the app is just the excuse.

| Date | Area (Auth / Edge Functions / Branching / Storage / other) | What I tried | What happened | Severity (blocked / slowed / papercut / delight) | Suggested fix |
|------|------|------|------|------|------|
|      |      |      |      |      |      |

## Things worth probing on purpose

**Auth**
- Sign up → profile row created by trigger. Does it work on a fresh preview branch?
- Magic-link + redirect URLs on preview branches (wildcards in `config.toml`).
- Confirmations on in prod, off locally: surprises?
- Add OAuth (Google/Apple) and test the redirect on a branch URL.

**Edge Functions**
- `verify_jwt` true vs false (compare `vet-search` with `vaccine-reminders`).
- Calling with the user's JWT so RLS applies (`share-link`) vs service role (`vaccine-reminders`).
- Secrets on a preview branch: how do you set them? Do they carry over?
- Local `functions serve` vs deployed behaviour (CORS, env, cold starts).

**Branching**
- Does a destructive migration on a branch ever touch production data? (It shouldn't. Verify.)
- Seed data on every branch: is `seed.sql` the right tool or is it a papercut?
- Buckets in migrations vs dashboard-created buckets: what gets copied?
- Merge conflicts when two branches add migrations; timestamp ordering.
- Cron setup on branches (see `supabase/snippets/schedule-reminders.sql`).

**Storage**
- Large uploads from mobile (resumable/TUS) vs standard upload.
- Signed URL expiry, `download` option, image transformations for thumbnails.
- Orphaned files when a pet is deleted (DB cascades, Storage does not): how would you clean up?
- MIME restrictions: try uploading a `.heic` from an iPhone.
