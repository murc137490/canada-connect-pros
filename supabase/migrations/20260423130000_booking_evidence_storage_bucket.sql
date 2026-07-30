-- Creates the booking-evidence bucket used by BookingProofUploadDialog, BookingEvidenceGallery,
-- and BookingClaimDialog refund attachments. Without this, uploads fail with "Bucket not found".

insert into storage.buckets (id, name, public)
values ('booking-evidence', 'booking-evidence', true)
on conflict (id) do update set public = true;

-- Public read so getPublicUrl works for evidence galleries and admin claim links.
drop policy if exists "Anyone can read booking-evidence" on storage.objects;
create policy "Anyone can read booking-evidence"
  on storage.objects for select
  to public
  using (bucket_id = 'booking-evidence');

-- Upload paths are `{booking_id}/...` or `{booking_id}/claim/...` — first segment must match bookings.id.
drop policy if exists "Booking parties can upload booking-evidence" on storage.objects;
create policy "Booking parties can upload booking-evidence"
  on storage.objects for insert
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

drop policy if exists "Booking parties can update booking-evidence" on storage.objects;
create policy "Booking parties can update booking-evidence"
  on storage.objects for update
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

drop policy if exists "Booking parties can delete booking-evidence" on storage.objects;
create policy "Booking parties can delete booking-evidence"
  on storage.objects for delete
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
