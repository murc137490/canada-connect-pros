-- =============================================================================
-- PASTE THIS ENTIRE FILE into Supabase → SQL Editor → Run
-- (Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS)
--
-- Includes:
-- 1) pro_profiles.referral_invite_panel_enabled + admin update policy
-- 2) mark_referral_invite_completed + reconcile_my_referrals (latest logic)
-- 3) Grants on reconcile_my_referrals
--
-- Does NOT create referral_invites table or auth triggers. If those are missing,
-- apply migrations from the repo starting with 20260504160000_referral_invites_growth_coupon.sql
-- =============================================================================

-- ----- A) Invite sidebar flag + admin policy -----
alter table public.pro_profiles
  add column if not exists referral_invite_panel_enabled boolean not null default true;

comment on column public.pro_profiles.referral_invite_panel_enabled is
  'When true, verified pros see the Invite a friend sidebar. Set false after referral reward claim, by the pro closing the panel, or by admin.';

drop policy if exists "Premiere admin can update any pro profile" on public.pro_profiles;
create policy "Premiere admin can update any pro profile"
on public.pro_profiles
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'premiereservicescontact@gmail.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'premiereservicescontact@gmail.com');

-- ----- B) Referral completion (auth trigger target) + dashboard reconcile -----
create or replace function public.mark_referral_invite_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  invitee text;
  pending_for_email int;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  invitee := lower(trim(new.email::text));
  if invitee is null or invitee = '' then
    return new;
  end if;

  ref_code := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), '');

  select count(*)::int into pending_for_email
  from public.referral_invites ri0
  where ri0.status = 'pending'
    and ri0.invited_user_id is null
    and lower(trim(ri0.invitee_email)) = invitee;

  begin
    update public.referral_invites
    set
      invited_user_id = new.id,
      status = 'completed',
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now(),
      reward_code = coalesce(
        nullif(reward_code, 'freetrial'),
        'rwd_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
      )
    where status = 'pending'
      and invited_user_id is null
      and inviter_user_id <> new.id
      and lower(trim(invitee_email)) = invitee
      and (
        (ref_code is not null and lower(trim(referral_code)) = ref_code)
        or pending_for_email = 1
      );
  exception
    when others then
      raise warning 'mark_referral_invite_completed skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.reconcile_my_referrals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.referral_invites ri set
    invited_user_id = au.id,
    status = 'completed',
    accepted_at = coalesce(ri.accepted_at, now()),
    updated_at = now(),
    reward_code = coalesce(
      nullif(ri.reward_code, 'freetrial'),
      'rwd_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    )
  from auth.users au
  cross join lateral (
    select count(*)::int as c
    from public.referral_invites ri2
    where ri2.status = 'pending'
      and ri2.invited_user_id is null
      and lower(trim(ri2.invitee_email)) = lower(trim(au.email::text))
  ) p
  where ri.status = 'pending'
    and ri.invited_user_id is null
    and ri.inviter_user_id = auth.uid()
    and ri.inviter_user_id <> au.id
    and au.email_confirmed_at is not null
    and lower(trim(ri.invitee_email)) = lower(trim(au.email::text))
    and (
      (
        nullif(lower(trim(coalesce(au.raw_user_meta_data ->> 'referral_code', ''))), '') is not null
        and lower(trim(ri.referral_code)) = nullif(lower(trim(coalesce(au.raw_user_meta_data ->> 'referral_code', ''))), '')
      )
      or p.c = 1
    );

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.reconcile_my_referrals() from public;
grant execute on function public.reconcile_my_referrals() to authenticated;
