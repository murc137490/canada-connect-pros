-- Client booking verification: photo with ID saved on profiles; private storage bucket.

alter table public.profiles
  add column if not exists booking_id_verification_photo_path text;

comment on column public.profiles.booking_id_verification_photo_path is
  'Storage path in client-booking-verification bucket (userId/uuid.ext). Used to skip re-upload on future bookings.';

insert into storage.buckets (id, name, public)
values ('client-booking-verification', 'client-booking-verification', false)
on conflict (id) do update set public = false;

drop policy if exists "Users read own client-booking-verification" on storage.objects;
create policy "Users read own client-booking-verification"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'client-booking-verification'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users upload own client-booking-verification" on storage.objects;
create policy "Users upload own client-booking-verification"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'client-booking-verification'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users update own client-booking-verification" on storage.objects;
create policy "Users update own client-booking-verification"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'client-booking-verification'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users delete own client-booking-verification" on storage.objects;
create policy "Users delete own client-booking-verification"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-booking-verification'
    and split_part(name, '/', 1) = auth.uid()::text
  );
