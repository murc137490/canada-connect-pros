-- Security review 2026-10-08, MED 5 / MED 6.
-- Public buckets serve files by URL (/storage/v1/object/public/...) without any SELECT policy, so
-- the broad "Anyone can read …" SELECT policies only enabled anonymous LISTING of every object.
-- The app never lists these buckets as anon (only booking-evidence, which is private and party-
-- scoped). resolveStorageDisplayUrl() tries createSignedUrl first and falls back to the public URL,
-- so display keeps working.

-- MED 5: drop anonymous listing on public buckets.
drop policy if exists "Anyone can read job-request-photos" on storage.objects;
drop policy if exists "Anyone can read pro-photos" on storage.objects;
drop policy if exists "Anyone can read pro-public" on storage.objects;
drop policy if exists "Anyone can read review-photos" on storage.objects;

-- Owners keep SELECT on their own folder (needed for upsert/overwrite and signed URLs of own files).
drop policy if exists "Users read own pro-photos" on storage.objects;
create policy "Users read own pro-photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'pro-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "Users read own job-request-photos" on storage.objects;
create policy "Users read own job-request-photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-request-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists "Moderators read job-request-photos" on storage.objects;
create policy "Moderators read job-request-photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-request-photos' and public.auth_is_platform_moderator());

drop policy if exists "Pros read own banner" on storage.objects;
create policy "Pros read own banner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pro-public'
    and (storage.foldername(name))[1] = 'banners'
    and exists (
      select 1 from public.pro_profiles pp
      where pp.user_id = auth.uid() and (pp.id)::text = (storage.foldername(name))[2]
    )
  );

-- MED 6: pro-photos uploads only into the uploader's own folder. Every upload path in the app is
-- `${user.id}/...` (avatar, profile, gallery, portfolio); all 35 existing objects follow it.
drop policy if exists "Authenticated can upload pro-photos" on storage.objects;
create policy "Authenticated can upload pro-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pro-photos' and (storage.foldername(name))[1] = (auth.uid())::text);

-- MED 6: image-only + 10 MB on the public buckets (no SVG: avoids stored XSS via public URLs).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif'],
    file_size_limit = 10485760
where id in ('pro-photos', 'pro-public', 'job-request-photos', 'review-photos');

-- Private buckets (client-booking-verification, booking-evidence, pro-verification) are unchanged here:
-- booking evidence accepts videos and client ID uploads may arrive without a MIME type.
