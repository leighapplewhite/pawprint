-- pgTAP: users must never see or write another user's data. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev');

insert into public.pets (id, owner_id, name) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha'),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

select is((select count(*) from public.pets)::int, 1, 'user A sees exactly one pet');
select is_empty($$ select 1 from public.pets where name = 'Beta' $$, 'user A cannot see user B''s pet');
select throws_ok(
  $$ insert into public.weight_entries (pet_id, weight_kg) values ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 5) $$,
  '42501', null, 'user A cannot log weight for user B''s pet');
select lives_ok(
  $$ insert into public.weight_entries (pet_id, weight_kg) values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 5) $$,
  'user A can log weight for their own pet');

reset role;
select * from finish();
rollback;
