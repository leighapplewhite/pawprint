-- pgTAP: people must only see their own family's data. Run with `supabase test db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- The sign-up trigger gives each user a family.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev');

insert into public.pets (id, owner_id, family_id, name)
select 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', created_by, id, 'Alpha' from public.families where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
insert into public.pets (id, owner_id, family_id, name)
select 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', created_by, id, 'Beta' from public.families where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

create temp table invite_token (token uuid);
grant all on invite_token to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);

select is((select count(*) from public.pets)::int, 1, 'user A sees exactly one pet');
select is_empty($$ select 1 from public.pets where name = 'Beta' $$, 'user A cannot see user B''s pet');
select throws_ok(
  $$ insert into public.weight_entries (pet_id, weight_kg) values ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 5) $$,
  '42501', null, 'user A cannot log weight for user B''s pet');
select lives_ok(
  $$ insert into public.weight_entries (pet_id, weight_kg) values ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 5) $$,
  'user A can log weight for their own pet');

-- B invites A.
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);
insert into public.family_invites (family_id)
  select id from public.families where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
insert into invite_token select token from public.family_invites;

select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated')::text, true);
select lives_ok($$ select public.accept_family_invite((select token from invite_token)) $$, 'A accepts the invite');
select is((select count(*) from public.pets)::int, 2, 'A now sees both pets');
select throws_ok(
  $$ select public.accept_family_invite((select token from invite_token)) $$,
  'P0001', null, 'an invite link can only be used once');
select throws_ok(
  $$ insert into public.family_invites (family_id) select id from public.families where created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  '42501', null, 'a plain member cannot create invites');

-- The only owner cannot leave.
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated')::text, true);
select results_eq(
  $$ with d as (delete from public.family_members where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning 1) select count(*)::int from d $$,
  $$ values (0) $$, 'the last owner cannot leave their family');

reset role;
select * from finish();
rollback;
