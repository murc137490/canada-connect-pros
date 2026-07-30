-- Platform admins from PLATFORM_ADMIN_EMAILS / profiles.is_platform_admin (not a single hardcoded email).
-- Admin can set pro tier when billing row exists; dispute category on claims.

-- ----- RLS: use auth_is_platform_moderator() -----
drop policy if exists "Admin can read booking claim requests" on public.booking_claim_requests;
create policy "Admin can read booking claim requests"
  on public.booking_claim_requests for select to authenticated
  using (public.auth_is_platform_moderator());

drop policy if exists "Admin can update booking claim requests" on public.booking_claim_requests;
create policy "Admin can update booking claim requests"
  on public.booking_claim_requests for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

drop policy if exists "Admin can update any pro profile" on public.pro_profiles;
create policy "Admin can update any pro profile"
  on public.pro_profiles for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

drop policy if exists "Admin can update pro referral invite panel" on public.pro_profiles;
create policy "Admin can update pro referral invite panel"
  on public.pro_profiles for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

drop policy if exists "Premiere admin can read payments" on public.payments;
create policy "Platform admin can read payments"
  on public.payments for select to authenticated
  using (public.auth_is_platform_moderator());

drop policy if exists "Admin can read pro subscriptions" on public.pro_subscriptions;
create policy "Platform admin can read pro subscriptions"
  on public.pro_subscriptions for select to authenticated
  using (public.auth_is_platform_moderator());

-- ----- Tier enforcement: allow platform admins -----
create or replace function public.pro_profiles_enforce_subscription_tier_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_plan text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.subscription_tier is not distinct from old.subscription_tier then
    return new;
  end if;

  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if public.auth_is_platform_moderator() then
    return new;
  end if;

  select lower(trim(plan_id))
    into sub_plan
  from public.pro_subscriptions
  where user_id = new.user_id
  limit 1;

  if sub_plan is not null
     and lower(trim(coalesce(new.subscription_tier, ''))) = sub_plan then
    return new;
  end if;

  new.subscription_tier := old.subscription_tier;
  return new;
end;
$$;

-- ----- accept_pro_by_admin -----
create or replace function public.accept_pro_by_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'Forbidden: platform admin only';
  end if;
  if not exists (select 1 from public.pro_subscriptions s where s.user_id = p_user_id) then
    raise exception 'No subscription on file: applicant must complete Pro Plans checkout before approval.';
  end if;
  update public.pro_profiles
  set is_verified = true, updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- ----- Admin sets tier on profile + billing row -----
create or replace function public.admin_set_pro_subscription_tier(
  p_pro_profile_id uuid,
  p_tier text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tier text;
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'Forbidden: platform admin only';
  end if;

  v_tier := lower(trim(coalesce(p_tier, '')));
  if v_tier not in ('hold', 'starter', 'growth', 'pro') then
    raise exception 'Invalid tier. Use hold, starter, growth, or pro.';
  end if;

  select user_id into v_user_id
  from public.pro_profiles
  where id = p_pro_profile_id;

  if v_user_id is null then
    raise exception 'Pro profile not found';
  end if;

  update public.pro_subscriptions
  set plan_id = v_tier, updated_at = now()
  where user_id = v_user_id;

  if not found then
    insert into public.pro_subscriptions (user_id, plan_id, updated_at)
    values (v_user_id, v_tier, now());
  end if;

  update public.pro_profiles
  set subscription_tier = v_tier, updated_at = now()
  where id = p_pro_profile_id;
end;
$$;

revoke all on function public.admin_set_pro_subscription_tier(uuid, text) from public;
grant execute on function public.admin_set_pro_subscription_tier(uuid, text) to authenticated;

-- ----- Dispute category (valid report reasons) -----
alter table public.booking_claim_requests add column if not exists dispute_category text;

alter table public.booking_claim_requests drop constraint if exists booking_claim_requests_dispute_category_check;
alter table public.booking_claim_requests add constraint booking_claim_requests_dispute_category_check
  check (
    dispute_category is null
    or dispute_category in (
      'provider_never_arrived',
      'incomplete_service',
      'visible_damage',
      'wrong_service',
      'major_quality_issue',
      'safety_issue',
      'unauthorized_charges'
    )
  );

comment on column public.booking_claim_requests.dispute_category is
  'Valid dispute reason selected by client; see app dispute policy.';
