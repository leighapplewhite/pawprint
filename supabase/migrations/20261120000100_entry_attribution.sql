-- Record who made each entry -----------------------------------------------------
-- Every record gets a "created_by" (pets and files already have "owner_id", which now
-- means the same thing). The database stamps it from the signed-in user, so it can't be
-- faked, and nobody can rewrite it later when they edit someone else's entry.
-- Requires 20261120000000_families.sql.

-- 1. New column on the record tables -------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format('alter table public.%I add column created_by uuid references public.profiles (id) on delete set null', t);
    execute format('create index %I on public.%I (created_by)', t || '_created_by_idx', t);
  end loop;
end
$$;

-- 2. Backfill ---------------------------------------------------------------------------
-- Before anyone else joined a family, every entry in it could only have been made by its
-- owner. Entries made after the first member joined stay unknown (NULL); we won't guess.
do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format(
      $q$update public.%1$I r set created_by = f.created_by
         from public.pets p
         join public.families f on f.id = p.family_id
         where p.id = r.pet_id
           and r.created_by is null
           and r.created_at < coalesce(
             (select min(m.joined_at) from public.family_members m where m.family_id = f.id and m.role = 'member'),
             'infinity'::timestamptz)$q$, t);
  end loop;
end
$$;

-- New rows default to the signed-in user.
do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format('alter table public.%I alter column created_by set default auth.uid()', t);
  end loop;
end
$$;

-- 3. Let the API show the author's name (pets and files point at profiles too) --------
alter table public.pets add constraint pets_owner_id_profiles_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;
alter table public.documents add constraint documents_owner_id_profiles_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;
create index if not exists documents_owner_idx on public.documents (owner_id);

-- 4. Authorship can't be faked or changed ----------------------------------------------
-- Signed-in requests: INSERT stamps the caller; UPDATE keeps the original author.
-- The one exception is the automatic clean-up when an author's account is deleted.
-- Internal work with no signed-in user (migrations, seed data) is left alone.
-- SECURITY DEFINER so the "does this author still exist?" check isn't hidden by RLS.
create function private.stamp_author() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  col text := tg_argv[0];
  uid uuid := (select auth.uid());
  old_author uuid;
begin
  if uid is null then return new; end if;
  if tg_op = 'INSERT' then
    new := jsonb_populate_record(new, jsonb_build_object(col, uid));
  else
    old_author := nullif(to_jsonb(old) ->> col, '')::uuid;
    if old_author is not null
       and not exists (select 1 from public.profiles pr where pr.id = old_author)
       and (to_jsonb(new) ->> col) is null then
      return new;  -- the author's account was deleted
    end if;
    new := jsonb_populate_record(new, jsonb_build_object(col, to_jsonb(old) -> col));
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['weight_entries', 'vaccinations', 'medical_events', 'food_logs', 'dna_results']
  loop
    execute format(
      'create trigger stamp_author before insert or update on public.%I
         for each row execute function private.stamp_author(%L)', t, 'created_by');
  end loop;
end
$$;
create trigger stamp_author before insert or update on public.pets
  for each row execute function private.stamp_author('owner_id');
create trigger stamp_author before insert or update on public.documents
  for each row execute function private.stamp_author('owner_id');

-- 5. Anyone in the family may edit a file's details, not only the uploader ---------------
-- (The old single policy required owner_id = you on every change, which blocked this.)
drop policy "family documents" on public.documents;
create policy "family documents: read" on public.documents for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)));
create policy "family documents: add" on public.documents for insert to authenticated
  with check (owner_id = (select auth.uid())
    and exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)));
create policy "family documents: edit" on public.documents for update to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)))
  with check (exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)));
create policy "family documents: delete" on public.documents for delete to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and private.is_family_member(p.family_id)));
