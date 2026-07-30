-- =============================================================================
-- Booking evidence bucket + storage policies (run if uploads say "Bucket not found")
-- =============================================================================
--
-- If the Supabase SQL Editor shows "failed to fetch", that is usually a browser
-- or session issue (not the SQL text). Try: refresh the dashboard, log in again,
-- disable VPN/ad-block for app.supabase.com, or run each STEP below separately.
--
-- OPTIONAL — create the bucket without SQL:
--   Dashboard → Storage → New bucket → Name: booking-evidence → Public: ON
-- Then run only STEP 2 onward (skip STEP 1).
--
-- =============================================================================

-- STEP 1 — Bucket (skip if you created the bucket in the Storage UI)
insert into storage.buckets (id, name, public)
values ('booking-evidence', 'booking-evidence', true)
on conflict (id) do update set public = true;

-- STEP 2 — Anyone can read public objects (needed for gallery / claim links)
drop policy if exists "Anyone can read booking-evidence" on storage.objects;
create policy "Anyone can read booking-evidence"
  on storage.objects
  for select
  to public
  using (bucket_id = 'booking-evidence');

-- STEP 3 — Client or pro on the booking can upload (path must start with booking UUID)
drop policy if exists "Booking parties can upload booking-evidence" on storage.objects;
create policy "Booking parties can upload booking-evidence"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );

-- STEP 4 — Same parties can replace files
drop policy if exists "Booking parties can update booking-evidence" on storage.objects;
create policy "Booking parties can update booking-evidence"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );

-- STEP 5 — Same parties can delete
drop policy if exists "Booking parties can delete booking-evidence" on storage.objects;
create policy "Booking parties can delete booking-evidence"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );
