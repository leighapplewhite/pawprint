-- Families: several people share one set of pets ---------------------------------
-- Every user gets a family automatically. Owners invite others with a link;
-- anyone in a family can see and edit its pets, records, and files.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Tables ------------------------------------------------------------------------
create table public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id);

create table public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  email       text,                                   -- optional: who the owner meant to invite
  token       uuid not null unique default gen_random_uuid(),
  invited_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);
create index family_invites_family_idx on public.family_invites (family_id);

-- Helpers. SECURITY DEFINER avoids recursive policies; living in "private" keeps
-- them out of the public API.
create function private.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m
                 where m.family_id = fid and m.user_id = (select auth.uid()));
$$;

create function private.is_family_owner(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m
                 where m.family_id = fid and m.user_id = (select auth.uid()) and m.role = 'owner');
$$;

create function private.has_other_owner(fid uuid, excluded uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members m
                 where m.family_id = fid and m.role = 'owner' and m.user_id <> excluded);
$$;

create function private.shares_family_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.family_members a
                 join public.family_members b on b.family_id = a.family_id
                 where a.user_id = other and b.user_id = (select auth.uid()));
$$;

revoke all on function private.is_family_member(uuid), private.is_family_owner(uuid),
  private.has_other_owner(uuid, uuid), private.shares_family_with(uuid) from public, anon;
grant execute on function private.is_family_member(uuid), private.is_family_owner(uuid),
  private.has_other_owner(uuid, uuid), private.shares_family_with(uuid) to authenticated;

-- A family's creator becomes its first owner.
create function private.add_creator_as_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.family_members (family_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;
create trigger on_family_created after insert on public.families
  for each row execute function private.add_creator_as_owner();

-- Give existing users a family and move their pets into it -------------------------
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

insert into public.families (name, created_by)
select coalesce(nullif(p.display_name, ''), 'My') || '’s family', p.id
from public.profiles p;

alter table public.pets add column family_id uuid references public.families (id) on delete cascade;

update public.pets
set family_id = (select f.id from public.families f where f.created_by = pets.owner_id order by f.created_at limit 1);

alter table public.pets alter column family_id set not null;
create index pets_family_idx on public.pets (family_id);

-- "owner_id" now just means "who added this". Removing a person must not delete
-- the family's pets or files.
alter table public.pets drop constraint pets_owner_id_fkey;
alter table public.pets alter column owner_id drop not null;
alter table public.pets add constraint pets_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

alter table public.documents drop constraint documents_owner_id_fkey;
alter table public.documents alter column owner_id drop not null;
alter table public.documents add constraint documents_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

-- New sign-ups get a family too.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  dn text := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, display_name) values (new.id, dn);
  insert into public.families (name, created_by) values (dn || '’s family', new.id);
  return new;
end;
$$;

-- Row Level Security: new tables ---------------------------------------------------
alter table public.families        enable row level security;
alter table public.family_members  enable row level security;
alter table public.family_invites  enable row level security;

create policy "members see their family" on public.families for select to authenticated
  using (private.is_family_member(id));
create policy "owners rename family" on public.families for update to authenticated
  using (private.is_family_owner(id)) with check (private.is_family_owner(id));

create policy "members see members" on public.family_members for select to authenticated
  using (private.is_family_member(family_id));
-- Leave yourself (unless you're the last owner), or an owner removes someone else.
create policy "leave or remove" on public.family_members for delete to authenticated
  using (
    (user_id = (select auth.uid())
      and (role <> 'owner' or private.has_other_owner(family_id, user_id)))
    or (private.is_family_owner(family_id) and user_id <> (select auth.uid()))
  );

create policy "owners manage invites" on public.family_invites for all to authenticated
  using (private.is_family_owner(family_id))
  with check (private.is_family_owner(family_id) and invited_by = (select auth.uid()));

-- People can see the names of the people they share a family with.
create policy "family profiles" on public.profiles for select to authenticated
  using (private.shares_family_with(id));

-- Row Level Security: pets and everything under them follows family membership ------
drop policy "own pets" on public.pets;
create policy "family pets" on public.pets for all to authenticated
  using (private.is_family_member(family_id))
  with check (private.is_family_member(family_id));

drop policy "own documents" on public.documents;
create policy "family documents" on public.documents for all to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id))
  );

do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format('drop policy "owner access" on public.%I', t);
    execute format(
      $p$create policy "family access" on public.%1$I for all to authenticated
         using (exists (select 1 from public.pets p where p.id = %1$I.pet_id and private.is_family_member(p.family_id)))
         with check (exists (select 1 from public.pets p where p.id = %1$I.pet_id and private.is_family_member(p.family_id)))$p$,
      t);
  end loop;
end
$$;

-- Storage: file paths are {uploader}/{pet_id}/{file}; access follows the pet's family.
-- Note: use objects.name, because pets also has a "name" column inside the subquery.
drop policy "pet files: read own"   on storage.objects;
drop policy "pet files: upload own" on storage.objects;
drop policy "pet files: update own" on storage.objects;
drop policy "pet files: delete own" on storage.objects;

create policy "pet files: family read" on storage.objects for select to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents') and exists (
    select 1 from public.pets p
    where p.id::text = (storage.foldername(objects.name))[2] and private.is_family_member(p.family_id)));

create policy "pet files: family upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('pet-photos', 'pet-documents')
    and (storage.foldername(objects.name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[2] and private.is_family_member(p.family_id)));

create policy "pet files: family update" on storage.objects for update to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents') and exists (
    select 1 from public.pets p
    where p.id::text = (storage.foldername(objects.name))[2] and private.is_family_member(p.family_id)));

create policy "pet files: family delete" on storage.objects for delete to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents') and exists (
    select 1 from public.pets p
    where p.id::text = (storage.foldername(objects.name))[2] and private.is_family_member(p.family_id)));

-- Joining by invite link ------------------------------------------------------------
create function public.preview_family_invite(invite_token uuid)
returns table (family_name text, inviter_name text)
language sql stable security definer set search_path = '' as $$
  select f.name, pr.display_name
  from public.family_invites i
  join public.families f on f.id = i.family_id
  left join public.profiles pr on pr.id = i.invited_by
  where i.token = invite_token and i.accepted_at is null and i.expires_at > now();
$$;

create function public.accept_family_invite(invite_token uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv record;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to join a family.'; end if;
  select * into inv from public.family_invites
   where token = invite_token and accepted_at is null and expires_at > now()
   for update;
  if not found then raise exception 'This invite link has expired or was already used.'; end if;
  insert into public.family_members (family_id, user_id, role)
  values (inv.family_id, (select auth.uid()), 'member')
  on conflict do nothing;
  update public.family_invites set accepted_at = now(), accepted_by = (select auth.uid()) where id = inv.id;
  return inv.family_id;
end;
$$;

revoke all on function public.preview_family_invite(uuid), public.accept_family_invite(uuid) from public, anon, authenticated;
grant execute on function public.preview_family_invite(uuid), public.accept_family_invite(uuid) to authenticated;
