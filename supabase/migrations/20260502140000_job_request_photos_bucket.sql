-- Public photo bucket for customer job request images.

insert into storage.buckets (id, name, public)
values ('job-request-photos', 'job-request-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read job-request-photos" on storage.objects;
create policy "Anyone can read job-request-photos"
  on storage.objects for select
  using (bucket_id = 'job-request-photos');

drop policy if exists "Users can upload own job-request-photos" on storage.objects;
create policy "Users can upload own job-request-photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-request-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own job-request-photos" on storage.objects;
create policy "Users can update own job-request-photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'job-request-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own job-request-photos" on storage.objects;
create policy "Users can delete own job-request-photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-request-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
