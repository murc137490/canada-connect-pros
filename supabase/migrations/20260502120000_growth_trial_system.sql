-- Growth trial system: private trial grants, attempts, one-time personal links,
-- and trial metadata on pro_subscriptions.

alter table public.pro_subscriptions
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_source text check (trial_source is null or trial_source in ('normal', 'freetrial', 'personal')),
  add column if not exists square_customer_id text,
  add column if not exists square_card_id text,
  add column if not exists square_card_fingerprint text,
  add column if not exists square_trial_used boolean not null default false;

create index if not exists pro_subscriptions_trial_ends_at_idx
  on public.pro_subscriptions (trial_ends_at);

create unique index if not exists pro_subscriptions_square_card_fingerprint_trial_idx
  on public.pro_subscriptions (square_card_fingerprint)
  where square_card_fingerprint is not null and square_trial_used = true;

create table if not exists public.trial_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  token_value text unique,
  source text not null default 'personal' check (source = 'personal'),
  duration_days integer not null default 60 check (duration_days = 60),
  expires_at timestamptz,
  used_at timestamptz,
  used_by_user_id uuid references auth.users (id) on delete set null,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trial_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pro_profile_id uuid references public.pro_profiles (id) on delete set null,
  plan_id text not null default 'growth' references public.subscription_plans (id),
  source text not null check (source in ('normal', 'freetrial', 'personal')),
  status text not null default 'pending_profile' check (status in ('pending_profile', 'active', 'expired', 'cancelled')),
  duration_days integer not null check (duration_days in (7, 14, 60)),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  square_customer_id text not null,
  square_card_id text not null,
  square_card_fingerprint text,
  signup_ip text,
  token_id uuid references public.trial_tokens (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trial_grants_growth_only check (plan_id = 'growth')
);

create table if not exists public.trial_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_address text,
  user_id uuid references auth.users (id) on delete set null,
  source text not null check (source in ('normal', 'freetrial', 'personal')),
  created_at timestamptz not null default now()
);

create unique index if not exists trial_grants_user_id_idx
  on public.trial_grants (user_id);

create unique index if not exists trial_grants_square_card_fingerprint_idx
  on public.trial_grants (square_card_fingerprint)
  where square_card_fingerprint is not null;

create index if not exists trial_grants_status_idx
  on public.trial_grants (status);

create index if not exists trial_grants_trial_ends_at_idx
  on public.trial_grants (trial_ends_at);

create index if not exists trial_tokens_expires_at_idx
  on public.trial_tokens (expires_at);

create index if not exists trial_tokens_used_at_idx
  on public.trial_tokens (used_at);

create index if not exists trial_attempts_ip_created_at_idx
  on public.trial_attempts (ip_address, created_at);

alter table public.trial_grants enable row level security;
alter table public.trial_tokens enable row level security;
alter table public.trial_attempts enable row level security;

drop policy if exists "Users read own trial grants" on public.trial_grants;
create policy "Users read own trial grants"
  on public.trial_grants for select
  to authenticated
  using (user_id = auth.uid());

-- No client policies for trial_tokens or trial_attempts. Edge Functions use the
-- service role so personal links, IPs, and abuse counters are not exposed.

create or replace function public.cleanup_trial_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.trial_tokens
  where used_at is not null
     or token_value is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_trial_tokens() from public;
grant execute on function public.cleanup_trial_tokens() to service_role;
