-- Pawprint core schema ------------------------------------------------------

create type public.pet_species   as enum ('dog', 'cat', 'other');
create type public.medical_kind  as enum ('checkup', 'surgery', 'illness', 'injury', 'dental', 'other');
create type public.doc_category  as enum ('photo', 'vaccine_record', 'lab_result', 'dna_result', 'insurance', 'other');

-- Profiles ------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pets ----------------------------------------------------------------------
create table public.pets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  species      public.pet_species not null default 'dog',
  breed        text,
  sex          text not null default 'unknown' check (sex in ('female', 'male', 'unknown')),
  birthdate    date,
  microchip_id text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index pets_owner_idx on public.pets (owner_id);

-- Documents (metadata for files in Storage) ------------------------------------
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pet_id       uuid not null references public.pets (id) on delete cascade,
  category     public.doc_category not null default 'other',
  bucket       text not null check (bucket in ('pet-photos', 'pet-documents')),
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  caption      text,
  created_at   timestamptz not null default now()
);
create index documents_pet_idx on public.documents (pet_id, created_at desc);

-- Growth --------------------------------------------------------------------
create table public.weight_entries (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   numeric(6, 2) not null check (weight_kg > 0),
  notes       text,
  created_at  timestamptz not null default now()
);
create index weight_entries_pet_idx on public.weight_entries (pet_id, measured_on);

-- Vaccinations ----------------------------------------------------------------
create table public.vaccinations (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets (id) on delete cascade,
  name            text not null,
  administered_on date not null,
  next_due_on     date,
  vet_name        text,
  lot_number      text,
  document_id     uuid references public.documents (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index vaccinations_pet_idx on public.vaccinations (pet_id, administered_on desc);
create index vaccinations_due_idx on public.vaccinations (next_due_on) where next_due_on is not null;

-- Surgeries, illnesses, checkups ------------------------------------------------
create table public.medical_events (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references public.pets (id) on delete cascade,
  kind       public.medical_kind not null default 'checkup',
  title      text not null,
  event_on   date not null default current_date,
  vet_name   text,
  cost_cents integer check (cost_cents >= 0),
  notes      text,
  created_at timestamptz not null default now()
);
create index medical_events_pet_idx on public.medical_events (pet_id, event_on desc);

-- Food ----------------------------------------------------------------------
create table public.food_logs (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid not null references public.pets (id) on delete cascade,
  brand          text not null,
  product        text,
  started_on     date not null default current_date,
  ended_on       date,
  daily_amount_g integer check (daily_amount_g > 0),
  rating         smallint check (rating between 1 and 5),
  reaction_notes text,
  created_at     timestamptz not null default now()
);
create index food_logs_pet_idx on public.food_logs (pet_id, started_on desc);

-- DNA results -----------------------------------------------------------------
create table public.dna_results (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references public.pets (id) on delete cascade,
  provider        text not null,
  tested_on       date,
  breed_breakdown jsonb not null default '[]'::jsonb,   -- [{ "breed": "Labrador", "percent": 42.5 }]
  health_notes    text,
  document_id     uuid references public.documents (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index dna_results_pet_idx on public.dna_results (pet_id);

-- Saved vets (per owner, not per pet) -------------------------------------------
create table public.saved_vets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  address    text,
  phone      text,
  website    text,
  osm_ref    text,
  lat        double precision,
  lng        double precision,
  notes      text,
  created_at timestamptz not null default now(),
  unique (owner_id, osm_ref)
);

-- Reminder bookkeeping (service role only; no user policies) --------------------
create table public.reminder_log (
  id             uuid primary key default gen_random_uuid(),
  vaccination_id uuid not null references public.vaccinations (id) on delete cascade,
  due_on         date not null,
  sent_at        timestamptz not null default now(),
  unique (vaccination_id, due_on)
);

-- Row Level Security -----------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.pets         enable row level security;
alter table public.documents    enable row level security;
alter table public.saved_vets   enable row level security;
alter table public.reminder_log enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own pets" on public.pets for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "own saved vets" on public.saved_vets for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "own documents" on public.documents for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = (select auth.uid()))
  );

-- Child tables: access follows pet ownership
do $$
declare
  t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      $p$create policy "owner access" on public.%1$I for all to authenticated
         using (exists (select 1 from public.pets p where p.id = %1$I.pet_id and p.owner_id = (select auth.uid())))
         with check (exists (select 1 from public.pets p where p.id = %1$I.pet_id and p.owner_id = (select auth.uid())))$p$,
      t
    );
  end loop;
end
$$;
