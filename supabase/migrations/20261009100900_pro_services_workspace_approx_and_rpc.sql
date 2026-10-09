-- Security follow-up 2026-10-09 (part 1 of 2, additive): pro_services workspace location.
-- Aymen's rule: only what's on the public profile, open availability and reviews are public.
-- The exact workspace address / coordinates become private in 20261009101000; this migration adds
-- what the app needs first:
--   * rounded public coordinates (2 decimals, about 1 km, same as pro_profiles.latitude_approx)
--     used by the public booking dialog for the "drive to the workspace" distance preview;
--   * get_pro_service_workspace(): exact address + coordinates for the pro themself, platform
--     moderators/admins, or a client with a booking or payment row with that pro (same pattern as
--     get_pro_billing_details).

alter table public.pro_services
  add column if not exists workspace_latitude_approx double precision
    generated always as (round(workspace_latitude::numeric, 2)::double precision) stored,
  add column if not exists workspace_longitude_approx double precision
    generated always as (round(workspace_longitude::numeric, 2)::double precision) stored;

comment on column public.pro_services.workspace_latitude_approx is
  'Public, rounded (2 decimals) workspace latitude for distance previews. Exact value is private.';
comment on column public.pro_services.workspace_longitude_approx is
  'Public, rounded (2 decimals) workspace longitude for distance previews. Exact value is private.';

create or replace function public.get_pro_service_workspace(p_pro_profile_id uuid)
returns table (
  id uuid,
  category_slug text,
  service_slug text,
  workspace_address text,
  workspace_latitude double precision,
  workspace_longitude double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.category_slug, s.service_slug, s.workspace_address, s.workspace_latitude, s.workspace_longitude
  from public.pro_services s
  join public.pro_profiles p on p.id = s.pro_profile_id
  where auth.uid() is not null
    and s.pro_profile_id = p_pro_profile_id
    and (
      p.user_id = auth.uid()
      or public.auth_is_platform_moderator()
      or exists (select 1 from public.bookings b where b.pro_profile_id = p.id and b.client_id = auth.uid())
      or exists (select 1 from public.payments pay where pay.pro_profile_id = p.id and pay.client_id = auth.uid())
    );
$$;
revoke all on function public.get_pro_service_workspace(uuid) from public, anon;
grant execute on function public.get_pro_service_workspace(uuid) to authenticated;
