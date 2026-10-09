-- Security review 2026-10-08 follow-up: reviews OF pros stay public (public.reviews), but pros'
-- reviews OF clients (public.client_reviews) are readable only by signed-in pros (any pro_profiles
-- owner), the reviewed client, and platform admins/moderators. No anon access.
-- App readers: Dashboard (pro: own pro_profile_id), DashboardReviewsPanel (client: client_id = me;
-- pro: own pro_profile_id), ReviewSection (pro owner only, for review blurring).

drop policy if exists "Anyone can read client reviews" on public.client_reviews;
drop policy if exists "Pros, reviewed client and admins read client reviews" on public.client_reviews;
create policy "Pros, reviewed client and admins read client reviews"
  on public.client_reviews for select to authenticated
  using (
    client_id = auth.uid()
    or exists (select 1 from public.pro_profiles pp where pp.user_id = auth.uid())
    or public.auth_is_platform_moderator()
  );

-- anon never reads or writes client reviews (all write policies need a pro owner's auth.uid()).
revoke all on public.client_reviews from anon;
revoke truncate, references, trigger on public.client_reviews from authenticated;
