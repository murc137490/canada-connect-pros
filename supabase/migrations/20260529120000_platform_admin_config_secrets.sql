-- Platform admins: Supabase secret PLATFORM_ADMIN_EMAILS only (comma-separated).
-- Synced by Edge Function ensure-platform-admin on sign-in. No Dashboard grant/revoke.

create table if not exists public.platform_admin_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

comment on table public.platform_admin_config is
  'Synced from PLATFORM_ADMIN_EMAILS Edge secret. Not editable in the app.';

alter table public.platform_admin_config enable row level security;

revoke all on table public.platform_admin_config from anon, authenticated;
grant select, insert, update, delete on table public.platform_admin_config to service_role;

insert into public.platform_admin_config (key, value)
values ('admin_emails', '')
on conflict (key) do nothing;

create or replace function public.platform_admin_emails()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(lower(trim(e)) order by lower(trim(e))),
    array[]::text[]
  )
  from unnest(
    string_to_array(
      coalesce(
        nullif((select c.value from public.platform_admin_config c where c.key = 'admin_emails' limit 1), ''),
        ''
      ),
      ','
    )
  ) as e
  where nullif(trim(e), '') is not null;
$$;

revoke all on function public.platform_admin_emails() from public;
grant execute on function public.platform_admin_emails() to authenticated;

create or replace function public.auth_is_platform_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(trim(coalesce(
    (select u.email::text from auth.users u where u.id = auth.uid()),
    coalesce(auth.jwt() ->> 'email', '')
  ))) = any (public.platform_admin_emails())
  or coalesce(
    (select p.is_platform_admin from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.auth_is_platform_moderator() from public;
grant execute on function public.auth_is_platform_moderator() to authenticated;

-- Only Edge sync (service_role) may change is_platform_admin.
create or replace function public.profiles_guard_platform_admin_column()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if coalesce(new.is_platform_admin, false) = coalesce(old.is_platform_admin, false) then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;
  raise exception 'Platform admin access is managed via PLATFORM_ADMIN_EMAILS secret only.';
end;
$$;

drop trigger if exists trg_profiles_guard_platform_admin on public.profiles;
create trigger trg_profiles_guard_platform_admin
  before update of is_platform_admin on public.profiles
  for each row
  execute function public.profiles_guard_platform_admin_column();

create or replace function public.grant_platform_admin_by_email(p_email text, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Platform admins are managed via PLATFORM_ADMIN_EMAILS secret only.';
end;
$$;

revoke all on function public.grant_platform_admin_by_email(text, boolean) from public;

drop function if exists public.list_platform_admin_accounts();

drop function if exists public.auth_email_is_supreme_admin();
drop function if exists public.platform_supreme_admin_email();
drop function if exists public.platform_delegated_admin_emails();
