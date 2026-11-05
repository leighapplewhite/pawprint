-- DEMO DATA: runs on `supabase db reset` and on every preview branch.
-- Never put real data here. Login: demo@pawprint.test / password123

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'demo@pawprint.test',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"display_name":"Demo Parent"}',
  now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at
) values (
  gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@pawprint.test"}',
  'email', now(), now(), now()
) on conflict do nothing;

insert into public.pets (id, owner_id, name, species, breed, sex, birthdate, microchip_id)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'Biscuit', 'dog', 'Golden Retriever', 'male', current_date - 425, '985112345678901')
on conflict (id) do nothing;

insert into public.weight_entries (pet_id, measured_on, weight_kg, notes) values
  ('22222222-2222-2222-2222-222222222222', current_date - 365, 4.2,  'Gotcha day'),
  ('22222222-2222-2222-2222-222222222222', current_date - 300, 11.8, null),
  ('22222222-2222-2222-2222-222222222222', current_date - 210, 19.5, null),
  ('22222222-2222-2222-2222-222222222222', current_date - 120, 26.1, null),
  ('22222222-2222-2222-2222-222222222222', current_date - 30,  29.4, 'Vet says on track');

insert into public.vaccinations (pet_id, name, administered_on, next_due_on, vet_name) values
  ('22222222-2222-2222-2222-222222222222', 'Rabies',     current_date - 335, current_date + 30,  'Valley Animal Clinic'),
  ('22222222-2222-2222-2222-222222222222', 'DHPP',       current_date - 300, current_date - 5,   'Valley Animal Clinic'),
  ('22222222-2222-2222-2222-222222222222', 'Bordetella', current_date - 90,  current_date + 275, 'Valley Animal Clinic');

insert into public.medical_events (pet_id, kind, title, event_on, vet_name, cost_cents, notes) values
  ('22222222-2222-2222-2222-222222222222', 'surgery', 'Neuter',        current_date - 150, 'Valley Animal Clinic', 28000, 'Recovered well.'),
  ('22222222-2222-2222-2222-222222222222', 'illness', 'Ear infection', current_date - 60,  'Valley Animal Clinic', 9500,  'Drops twice a day for 10 days.');

insert into public.food_logs (pet_id, brand, product, started_on, ended_on, daily_amount_g, rating, reaction_notes) values
  ('22222222-2222-2222-2222-222222222222', 'Acme Puppy', 'Large breed puppy', current_date - 365, current_date - 120, 250, 3, 'Soft stools at first.'),
  ('22222222-2222-2222-2222-222222222222', 'Acme Adult', 'Large breed adult', current_date - 120, null,              400, 5, 'Loves it.');
