-- Internal "hold" billing state: new pros and cancelled subs; not a customer-facing tier.

alter table public.subscription_plans drop constraint if exists subscription_plans_id_check;
alter table public.subscription_plans
  add constraint subscription_plans_id_check check (id in ('starter', 'growth', 'pro', 'hold'));

insert into public.subscription_plans (id, name, price_cents)
values ('hold', 'Hold', 0)
on conflict (id) do update set name = excluded.name, price_cents = excluded.price_cents;

-- New signups default to hold until they purchase starter/growth/pro.
alter table public.pro_profiles alter column subscription_tier set default 'hold';

-- Pros without a real paid/trial plan: profile should not read as starter.
update public.pro_profiles p
set subscription_tier = 'hold', updated_at = now()
where coalesce(lower(trim(p.subscription_tier)), '') in ('starter', '')
  and not exists (
    select 1
    from public.pro_subscriptions s
    where s.user_id = p.user_id
      and lower(trim(s.plan_id)) in ('starter', 'growth', 'pro')
  );

-- Every pro account gets a subscription row so admin RPCs stay consistent.
insert into public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
select p.user_id, 'hold', now(), 30, now()
from public.pro_profiles p
where not exists (select 1 from public.pro_subscriptions s where s.user_id = p.user_id)
on conflict (user_id) do nothing;

-- Sync profile tier to hold where billing is hold.
update public.pro_profiles p
set subscription_tier = 'hold', updated_at = now()
from public.pro_subscriptions s
where s.user_id = p.user_id
  and lower(trim(s.plan_id)) = 'hold'
  and coalesce(lower(trim(p.subscription_tier)), '') <> 'hold';

-- After insert on pro_profiles, ensure hold subscription exists (client cannot insert pro_subscriptions).
create or replace function public.pro_profiles_ensure_hold_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pro_subscriptions (user_id, plan_id, billing_start, billing_cycle_days, updated_at)
  values (new.user_id, 'hold', now(), 30, now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_pro_profiles_ensure_hold_subscription on public.pro_profiles;
create trigger trg_pro_profiles_ensure_hold_subscription
  after insert on public.pro_profiles
  for each row
  execute function public.pro_profiles_ensure_hold_subscription();

comment on function public.pro_profiles_ensure_hold_subscription() is
  'Creates pro_subscriptions row with plan hold when a pro profile is created (users cannot insert billing rows).';
