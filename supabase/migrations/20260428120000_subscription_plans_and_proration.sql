-- Subscription catalog + per-pro billing cycle + proration helper for plan changes.

create table if not exists public.subscription_plans (
  id text primary key check (id in ('starter', 'growth', 'pro')),
  name text not null,
  price_cents integer not null check (price_cents >= 0)
);

insert into public.subscription_plans (id, name, price_cents) values
('starter', 'Starter', 2000),
('growth', 'Growth', 2700),
('pro', 'Pro', 3200)
on conflict (id) do update set name = excluded.name, price_cents = excluded.price_cents;

create table if not exists public.pro_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  billing_start timestamptz not null default now(),
  billing_cycle_days integer not null default 30,
  updated_at timestamptz not null default now()
);

create index if not exists pro_subscriptions_plan_id_idx on public.pro_subscriptions (plan_id);

alter table public.subscription_plans enable row level security;
alter table public.pro_subscriptions enable row level security;

drop policy if exists "Anyone can read subscription plans" on public.subscription_plans;
create policy "Anyone can read subscription plans"
  on public.subscription_plans for select
  using (true);

drop policy if exists "Users read own pro subscription" on public.pro_subscriptions;
create policy "Users read own pro subscription"
  on public.pro_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- Proration: dollar amount to charge today for upgrading to a higher-priced plan mid-cycle.
create or replace function public.calculate_proration(
  old_price_cents integer,
  new_price_cents integer,
  billing_start timestamp with time zone,
  cycle_days integer
)
returns numeric
language plpgsql
stable
as $$
declare
  now_ts timestamptz := now();
  cycle_end timestamptz := billing_start + (cycle_days || ' days')::interval;
  total_seconds numeric;
  remaining_seconds numeric;
  price_diff_cents numeric;
  prorated_cents numeric;
begin
  if coalesce(new_price_cents, 0) <= coalesce(old_price_cents, 0) then
    return 0::numeric;
  end if;

  total_seconds := greatest(extract(epoch from (cycle_end - billing_start)), 1);
  remaining_seconds := extract(epoch from (cycle_end - now_ts));

  price_diff_cents := (new_price_cents - old_price_cents)::numeric;

  if remaining_seconds <= 0 then
    return round(price_diff_cents / 100.0, 2);
  end if;

  prorated_cents := price_diff_cents * (least(remaining_seconds, total_seconds) / total_seconds);
  return round(prorated_cents / 100.0, 2);
end;
$$;

grant execute on function public.calculate_proration(integer, integer, timestamp with time zone, integer) to anon, authenticated, service_role;
