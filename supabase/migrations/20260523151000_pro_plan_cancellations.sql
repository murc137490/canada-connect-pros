-- Log voluntary plan cancellations (admin / analytics). Edge Function inserts via service_role.

create table if not exists public.pro_plan_cancellations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pro_profile_id uuid not null references public.pro_profiles (id) on delete cascade,
  previous_plan_id text not null,
  reason_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists pro_plan_cancellations_user_id_idx on public.pro_plan_cancellations (user_id);
create index if not exists pro_plan_cancellations_created_at_idx on public.pro_plan_cancellations (created_at desc);

alter table public.pro_plan_cancellations enable row level security;

comment on table public.pro_plan_cancellations is
  'Pros who confirmed cancellation of starter/growth/pro; used for analytics. No client policies — Edge Functions use service_role.';
