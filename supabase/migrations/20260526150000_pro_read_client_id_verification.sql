-- Pros can view client ID verification photos for bookings on their profile (pending/accepted/completed).
drop policy if exists "Pros read client booking verification for their bookings" on storage.objects;
create policy "Pros read client booking verification for their bookings"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'client-booking-verification'
    and exists (
      select 1
      from public.bookings b
      join public.pro_profiles pp on pp.id = b.pro_profile_id
      where pp.user_id = auth.uid()
        and b.client_id::text = split_part(name, '/', 1)
        and b.status in ('pending', 'accepted', 'completed')
    )
  );

-- Platform moderators can read pro private uploads (ID/selfie) for application review.
drop policy if exists "Platform moderators read all pro-photos" on storage.objects;
create policy "Platform moderators read all pro-photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pro-photos'
    and public.auth_is_platform_moderator()
  );
