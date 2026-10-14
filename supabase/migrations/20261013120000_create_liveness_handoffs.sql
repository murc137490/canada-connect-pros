create table if not exists public.pro_liveness_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  challenge text not null,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'consumed')),
  storage_path text,
  mime_type text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  consumed_at timestamptz
);

create index if not exists pro_liveness_handoffs_owner_status_idx
  on public.pro_liveness_handoffs (user_id, status, expires_at desc);

alter table public.pro_liveness_handoffs enable row level security;
revoke all on public.pro_liveness_handoffs from anon, authenticated;
grant all on public.pro_liveness_handoffs to service_role;
