-- Storage buckets + policies ----------------------------------------------------
-- Buckets live in a migration (not just the dashboard) so every preview branch gets them.
-- File path convention: {user_id}/{pet_id}/{timestamp}-{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-photos',    'pet-photos',    false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('pet-documents', 'pet-documents', false, 26214400,
    array['application/pdf', 'image/jpeg', 'image/png', 'text/csv', 'text/plain',
          'application/json', 'application/zip'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "pet files: read own"
  on storage.objects for select to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pet files: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('pet-photos', 'pet-documents')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pet files: update own"
  on storage.objects for update to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "pet files: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id in ('pet-photos', 'pet-documents')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
