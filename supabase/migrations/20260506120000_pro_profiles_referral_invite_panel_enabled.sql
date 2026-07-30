-- Controls visibility of the "Invite a friend" sidebar for verified pros.
-- Admins can toggle; claim flow sets false after redemption.

alter table public.pro_profiles
  add column if not exists referral_invite_panel_enabled boolean not null default true;

comment on column public.pro_profiles.referral_invite_panel_enabled is
  'When true, verified pros see the Invite a friend sidebar. Set false after referral reward claim, by the pro closing the panel, or by admin.';

-- Premiere admin can update any pro row (JWT email must match; same pattern as app isAdmin check).
drop policy if exists "Premiere admin can update any pro profile" on public.pro_profiles;
create policy "Premiere admin can update any pro profile"
on public.pro_profiles
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'premiereservicescontact@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'premiereservicescontact@gmail.com');
