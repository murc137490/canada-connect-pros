-- Per-pro Square OAuth: tokens live in a table with RLS and no policies (PostgREST denies all; Edge uses service role).
-- square_location_id on pro_profiles is public-readable (needed for Web Payments SDK with seller location).

alter table public.pro_profiles
  add column if not exists square_location_id text;

comment on column public.pro_profiles.square_location_id is
  'Square Location ID for this pro (OAuth-connected). Used by Web Payments SDK with the platform Application ID.';

create table if not exists public.pro_square_tokens (
  pro_profile_id uuid primary key references public.pro_profiles (id) on delete cascade,
  merchant_id text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.pro_square_tokens is
  'Square OAuth tokens per pro. No client access — only Edge Functions with service role.';

alter table public.pro_square_tokens enable row level security;

revoke all on public.pro_square_tokens from anon, authenticated;
grant select, insert, update, delete on public.pro_square_tokens to service_role;
