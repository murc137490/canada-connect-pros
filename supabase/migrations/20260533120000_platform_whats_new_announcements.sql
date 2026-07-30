-- Platform-wide What's New broadcasts (visible to all authenticated users for 7 days).

create table if not exists public.platform_whats_new_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  body text,
  href text not null default '/dashboard',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz
);

comment on table public.platform_whats_new_announcements is
  'Admin broadcasts shown in What''s New for every account until read or 7 days after publish.';

create index if not exists platform_whats_new_announcements_active_idx
  on public.platform_whats_new_announcements (created_at desc)
  where deleted_at is null;

alter table public.platform_whats_new_announcements enable row level security;

create policy platform_whats_new_select_active
  on public.platform_whats_new_announcements
  for select
  to authenticated
  using (deleted_at is null);

create policy platform_whats_new_insert_admin
  on public.platform_whats_new_announcements
  for insert
  to authenticated
  with check (public.auth_is_platform_moderator());

create policy platform_whats_new_update_admin
  on public.platform_whats_new_announcements
  for update
  to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

grant select, insert, update on public.platform_whats_new_announcements to authenticated;
