-- Enforce: pro_profiles.subscription_tier cannot be changed except by service_role (Edge Functions)
-- or when it matches pro_subscriptions.plan_id for that user (sync from billing).
-- Also: accept_pro_by_admin requires a subscription row. Admin can read plan payments for review.

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

drop trigger if exists pro_profiles_enforce_subscription_tier_billing_trg on public.pro_profiles;

create trigger pro_profiles_enforce_subscription_tier_billing_trg
  before update of subscription_tier on public.pro_profiles
  for each row
  execute function public.pro_profiles_enforce_subscription_tier_billing();

comment on function public.pro_profiles_enforce_subscription_tier_billing() is
  'Blocks client/admin arbitrary updates to subscription_tier unless they match pro_subscriptions.plan_id or the request uses service_role (checkout Edge Functions).';

-- Approve only when billing enrollment exists (trial or paid checkout both insert pro_subscriptions).
create or replace function public.accept_pro_by_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_email text;
begin
  select u.email into caller_email from auth.users u where u.id = auth.uid();
  if lower(trim(caller_email)) <> 'premiereservicescontact@gmail.com' then
    raise exception 'Forbidden: admin only';
  end if;
  if not exists (select 1 from public.pro_subscriptions s where s.user_id = p_user_id) then
    raise exception 'No subscription on file: applicant must complete Pro Plans checkout before approval.';
  end if;
  update public.pro_profiles
  set is_verified = true, updated_at = now()
  where user_id = p_user_id;
end;
$$;

grant execute on function public.accept_pro_by_admin(uuid) to authenticated;

-- Admin receipt: read Square plan-payment rows (booking_id is null for plan changes).
drop policy if exists "Premiere admin can read payments" on public.payments;
create policy "Premiere admin can read payments"
  on public.payments
  for select
  to authenticated
  using (lower(trim(coalesce(auth.jwt() ->> 'email', ''))) = 'premiereservicescontact@gmail.com');
