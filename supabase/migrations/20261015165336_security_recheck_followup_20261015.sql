-- Security follow-up based on the 2026-10-15 re-check.

-- Client reviews are visible to the reviewed client, moderators, and pros who
-- have actually had a booking with that client. A pro account alone is not enough.
drop policy if exists "Pros, reviewed client and admins read client reviews"
  on public.client_reviews;
create policy "Client, involved pros and admins read client reviews"
  on public.client_reviews for select to authenticated
  using (
    client_id = (select auth.uid())
    or public.auth_is_platform_moderator()
    or exists (
      select 1
      from public.bookings b
      join public.pro_profiles pp on pp.id = b.pro_profile_id
      where b.client_id = client_reviews.client_id
        and pp.user_id = (select auth.uid())
    )
  );

-- Client review writes require a signed-in pro owner. Keep update ownership
-- fixed on both the old and new row.
drop policy if exists "Pros can insert client review" on public.client_reviews;
create policy "Pros can insert client review"
  on public.client_reviews for insert to authenticated
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = client_reviews.pro_profile_id
        and pp.user_id = (select auth.uid())
    )
  );

drop policy if exists "Pros can update own client review" on public.client_reviews;
create policy "Pros can update own client review"
  on public.client_reviews for update to authenticated
  using (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = client_reviews.pro_profile_id
        and pp.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = client_reviews.pro_profile_id
        and pp.user_id = (select auth.uid())
    )
  );

-- Public profile visits are no longer insertable anonymously. Preserve
-- deduplicated visit counts for signed-in visitors, excluding self-visits.
drop policy if exists "Anyone can insert pro_profile_views" on public.pro_profile_views;
create policy "Signed-in visitors can insert pro_profile_views"
  on public.pro_profile_views for insert to authenticated
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_views.pro_profile_id
        and pp.user_id is distinct from (select auth.uid())
    )
  );
revoke insert on public.pro_profile_views from anon;

-- This global retention function is called by the moderator-only RPC, never
-- directly by browser users.
revoke all on function public.purge_job_requests_older_than_seven_days() from public;
revoke execute on function public.purge_job_requests_older_than_seven_days()
  from anon, authenticated;

-- Enforce upload constraints at Storage, not only in browser validation.
update storage.buckets
set file_size_limit = 8388608,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif', 'application/pdf'
    ]
where id = 'client-booking-verification';

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm'
    ]
where id = 'booking-evidence';
