-- Restrict recommendation visibility to accounts approved by the site's admin allowlist.
drop policy if exists "Platform admins read site recommendations" on public.front_desk_tickets;
create policy "Platform admins read site recommendations"
  on public.front_desk_tickets for select to authenticated
  using (
    kind = 'feature_request'
    and coalesce(subject, '') like 'About page recommendation:%'
    and public.auth_is_platform_moderator()
  );
