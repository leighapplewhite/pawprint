-- Run this ONCE per environment in the SQL editor (not as a migration).
-- It is deliberately not a migration: preview branches don't have the vault secrets,
-- so a cron job created by a migration would fire at a function it can't reach.
--
-- 1. Store the project URL + cron secret in Vault:
--      select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--      select vault.create_secret('<same value as CRON_SECRET function secret>', 'cron_secret');
-- 2. Enable the pg_cron and pg_net extensions (Dashboard → Database → Extensions).
-- 3. Schedule the job:

select cron.schedule(
  'daily-vaccine-reminders',
  '0 15 * * *',   -- 15:00 UTC every day
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/vaccine-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
