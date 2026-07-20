insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('os-fotos', 'os-fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "os_photos_authenticated_select" on storage.objects;
create policy "os_photos_authenticated_select"
on storage.objects for select
to authenticated
using (bucket_id = 'os-fotos');

drop policy if exists "os_photos_authenticated_insert" on storage.objects;
create policy "os_photos_authenticated_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'os-fotos');

drop policy if exists "os_photos_authenticated_update" on storage.objects;
create policy "os_photos_authenticated_update"
on storage.objects for update
to authenticated
using (bucket_id = 'os-fotos')
with check (bucket_id = 'os-fotos');

drop policy if exists "os_photos_authenticated_delete" on storage.objects;
create policy "os_photos_authenticated_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'os-fotos');
