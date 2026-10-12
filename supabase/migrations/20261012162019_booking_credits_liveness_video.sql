-- Booking Credit catalogue and auditable ledger. Existing leads/history are retained.
alter table public.subscription_plans add column if not exists monthly_booking_credits integer not null default 0 check (monthly_booking_credits >= 0);
update public.subscription_plans set
  name = case id when 'starter' then 'Starter' when 'growth' then 'Growth' when 'pro' then 'Pro' else name end,
  price_cents = case id when 'starter' then 2900 when 'growth' then 3900 when 'pro' then 4900 else price_cents end,
  monthly_booking_credits = case id when 'starter' then 5 when 'growth' then 10 when 'pro' then 18 else monthly_booking_credits end
where id in ('starter','growth','pro');

create table if not exists public.booking_credit_config (
  id boolean primary key default true check (id),
  coverage_cents integer not null default 10000 check (coverage_cents > 0),
  refill_price_cents_per_credit integer,
  monthly_expiry_days integer not null default 30 check (monthly_expiry_days > 0),
  updated_at timestamptz not null default now()
);
insert into public.booking_credit_config (id) values (true) on conflict (id) do nothing;
alter table public.booking_credit_config enable row level security;
create policy "Public can read booking credit config" on public.booking_credit_config for select using (true);

create table if not exists public.booking_credit_grants (
  id uuid primary key default gen_random_uuid(),
  pro_profile_id uuid not null references public.pro_profiles(id) on delete restrict,
  grant_type text not null check (grant_type in ('subscription','purchased','promotional','migration','admin')),
  granted integer not null check (granted > 0),
  remaining integer not null check (remaining >= 0 and remaining <= granted),
  expires_at timestamptz,
  source_reference text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (grant_type, source_reference)
);
create index if not exists booking_credit_grants_available_idx on public.booking_credit_grants (pro_profile_id, expires_at, created_at) where remaining > 0;
alter table public.booking_credit_grants enable row level security;
create policy "Pros can read own credit grants" on public.booking_credit_grants for select to authenticated
using (exists (select 1 from public.pro_profiles p where p.id = pro_profile_id and p.user_id = auth.uid()));
create policy "Moderators can read credit grants" on public.booking_credit_grants for select to authenticated using (public.auth_is_platform_moderator());

create table if not exists public.booking_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  pro_profile_id uuid not null references public.pro_profiles(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  grant_id uuid references public.booking_credit_grants(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('subscription_credit_grant','promotional_credit_grant','refill_purchase','booking_credit_reservation','booking_credit_consumption','booking_credit_release','booking_credit_refund','admin_adjustment','expiration','migration_adjustment')),
  credit_amount integer not null check (credit_amount > 0),
  source_reference text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_credit_ledger_pro_time_idx on public.booking_credit_ledger(pro_profile_id, created_at desc);
create unique index if not exists booking_credit_ledger_source_type_uidx on public.booking_credit_ledger(transaction_type, source_reference) where source_reference is not null;
alter table public.booking_credit_ledger enable row level security;
create policy "Pros can read own credit ledger" on public.booking_credit_ledger for select to authenticated
using (exists (select 1 from public.pro_profiles p where p.id = pro_profile_id and p.user_id = auth.uid()));
create policy "Moderators can read credit ledger" on public.booking_credit_ledger for select to authenticated using (public.auth_is_platform_moderator());
revoke insert, update, delete, truncate, references, trigger on public.booking_credit_grants from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.booking_credit_ledger from anon, authenticated;

create table if not exists public.booking_credit_reservations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  pro_profile_id uuid not null references public.pro_profiles(id) on delete restrict,
  eligible_value_cents bigint not null check (eligible_value_cents >= 0),
  credits_reserved integer not null check (credits_reserved >= 0),
  status text not null check (status in ('reserved','consumed','released','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);
create table if not exists public.booking_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.booking_credit_reservations(id) on delete restrict,
  grant_id uuid not null references public.booking_credit_grants(id) on delete restrict,
  credit_amount integer not null check (credit_amount > 0),
  created_at timestamptz not null default now(),
  unique (reservation_id, grant_id)
);
alter table public.booking_credit_reservations enable row level security;
alter table public.booking_credit_allocations enable row level security;
create policy "Pros read own booking reservations" on public.booking_credit_reservations for select to authenticated
using (exists (select 1 from public.pro_profiles p where p.id=pro_profile_id and p.user_id=auth.uid()));
create policy "Moderators read booking credit reservations" on public.booking_credit_reservations for select to authenticated using (public.auth_is_platform_moderator());
create policy "Pros read own booking credit allocations" on public.booking_credit_allocations for select to authenticated
using (exists (select 1 from public.booking_credit_reservations r join public.pro_profiles p on p.id=r.pro_profile_id where r.id=reservation_id and p.user_id=auth.uid()));
create policy "Moderators read booking credit allocations" on public.booking_credit_allocations for select to authenticated using (public.auth_is_platform_moderator());
revoke insert, update, delete, truncate, references, trigger on public.booking_credit_reservations from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.booking_credit_allocations from anon, authenticated;

create table if not exists public.booking_credit_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credit_amount integer not null check (credit_amount > 0),
  eligibility jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  credit_expires_days integer check (credit_expires_days is null or credit_expires_days > 0),
  combinable boolean not null default false,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.booking_credit_promotions enable row level security;
revoke all on public.booking_credit_promotions from anon, authenticated;

create or replace function public.prevent_booking_credit_ledger_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'Booking credit ledger entries are immutable; append a reversal or adjustment.'; end $$;
drop trigger if exists booking_credit_ledger_immutable on public.booking_credit_ledger;
create trigger booking_credit_ledger_immutable before update or delete on public.booking_credit_ledger
for each row execute function public.prevent_booking_credit_ledger_mutation();

-- Grants are idempotent; callable only by trusted server/service_role.
create or replace function public.grant_booking_credits(
  p_pro_profile_id uuid, p_grant_type text, p_amount integer, p_source_reference text,
  p_expires_at timestamptz default null, p_reason text default null, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_grant_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'not authorized'; end if;
  if p_amount <= 0 or p_grant_type not in ('subscription','purchased','promotional','migration','admin') then raise exception 'invalid grant'; end if;
  if nullif(trim(p_source_reference), '') is null then raise exception 'source reference is required for idempotency'; end if;
  insert into booking_credit_grants(pro_profile_id, grant_type, granted, remaining, expires_at, source_reference, metadata)
  values(p_pro_profile_id, p_grant_type, p_amount, p_amount, p_expires_at, p_source_reference, coalesce(p_metadata,'{}'::jsonb))
  on conflict (grant_type, source_reference) do nothing returning id into v_grant_id;
  if v_grant_id is null then select id into v_grant_id from booking_credit_grants where grant_type=p_grant_type and source_reference=p_source_reference; return v_grant_id; end if;
  insert into booking_credit_ledger(pro_profile_id, grant_id, transaction_type, credit_amount, source_reference, reason, metadata)
  values(p_pro_profile_id, v_grant_id,
    case p_grant_type when 'subscription' then 'subscription_credit_grant' when 'promotional' then 'promotional_credit_grant' when 'purchased' then 'refill_purchase' else 'migration_adjustment' end,
    p_amount, p_source_reference, p_reason, coalesce(p_metadata,'{}'::jsonb));
  return v_grant_id;
end $$;
revoke all on function public.grant_booking_credits(uuid,text,integer,text,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.grant_booking_credits(uuid,text,integer,text,timestamptz,text,jsonb) to service_role;

-- Optional liveness recording stays in private pro-verification storage for manual review.
update storage.buckets set file_size_limit=26214400,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf','video/webm','video/mp4']
where id='pro-verification';
alter table public.pro_verification_documents drop constraint if exists pro_verification_documents_document_type_check;
alter table public.pro_verification_documents add constraint pro_verification_documents_document_type_check
  check (document_type in ('insurance_certificate','trade_license','liveness_video'));

-- Do not retroactively mint credits from leads. Existing subscription rows are intentionally
-- preserved. Backfill the current subscription cycle once per existing plan row; this is keyed
-- by account and cycle start so rerunning the migration cannot duplicate credits.
with current_cycles as (
  select pp.id as pro_profile_id, ps.user_id, ps.plan_id, ps.billing_start,
         ps.billing_start + greatest(1, ceil(
           extract(epoch from (now() - ps.billing_start)) /
           (86400 * greatest(ps.billing_cycle_days, 1))
         )::integer * greatest(ps.billing_cycle_days, 1)) * interval '1 day' as expires_at,
         sp.monthly_booking_credits
  from public.pro_subscriptions ps
  join public.pro_profiles pp on pp.user_id = ps.user_id
  join public.subscription_plans sp on sp.id = ps.plan_id
  where ps.plan_id in ('starter', 'growth', 'pro')
    and sp.monthly_booking_credits > 0
), inserted_grants as (
  insert into public.booking_credit_grants(
    pro_profile_id, grant_type, granted, remaining, expires_at, source_reference, metadata
  )
  select pro_profile_id, 'subscription', monthly_booking_credits, monthly_booking_credits,
         expires_at, 'migration-cycle:' || user_id::text || ':' || billing_start::text,
         jsonb_build_object('plan_id', plan_id, 'cycle_start', billing_start, 'source', 'initial_migration')
  from current_cycles
  on conflict (grant_type, source_reference) do nothing
  returning id, pro_profile_id, granted, source_reference, metadata
)
insert into public.booking_credit_ledger(
  pro_profile_id, grant_id, transaction_type, credit_amount, source_reference, reason, metadata
)
select pro_profile_id, id, 'subscription_credit_grant', granted,
       source_reference, 'Current subscription-cycle credit migration', metadata
from inserted_grants;
