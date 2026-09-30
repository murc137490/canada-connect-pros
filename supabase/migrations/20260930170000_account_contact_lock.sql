-- Voice PIN plus locked phone and email.
-- A phone that is already on file, the login email, and the voice PIN
-- can only change through account-security after a one-time code.
-- The first phone (empty -> a number) stays open so signup can save it.

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists voice_pin_hash text;

comment on column public.profiles.voice_pin_hash is
  'Bcrypt hash of the 4–6 digit voice PIN. Never selected by the client.';

revoke select (voice_pin_hash), update (voice_pin_hash), insert (voice_pin_hash)
  on table public.profiles from public, anon, authenticated;
grant select (voice_pin_hash), update (voice_pin_hash) on table public.profiles to service_role;

create table if not exists public.account_contact_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('change_email', 'change_phone', 'change_pin')),
  channel text not null check (channel in ('sms', 'email')),
  destination text not null,
  code_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.account_contact_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('change_email', 'change_phone', 'change_pin')),
  new_value text,
  uses_left integer not null default 1,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_contact_challenges enable row level security;
alter table public.account_contact_grants enable row level security;
revoke all on public.account_contact_challenges from anon, authenticated;
revoke all on public.account_contact_grants from anon, authenticated;

create index if not exists account_contact_challenges_user_idx
  on public.account_contact_challenges (user_id, created_at desc);

create or replace function public.verify_voice_pin_hash(p_hash text, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_hash is null or p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return false;
  end if;
  return p_hash = extensions.crypt(p_pin, p_hash);
end;
$$;

create or replace function public.hash_voice_pin(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    return null;
  end if;
  return extensions.crypt(p_pin, extensions.gen_salt('bf'));
end;
$$;

create or replace function public.auth_email_taken(p_email text, p_except uuid)
returns boolean
language sql
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(btrim(p_email))
      and u.id is distinct from p_except
  );
$$;

revoke all on function public.verify_voice_pin_hash(text, text) from public, anon, authenticated;
revoke all on function public.hash_voice_pin(text) from public, anon, authenticated;
revoke all on function public.auth_email_taken(text, uuid) from public, anon, authenticated;
grant execute on function public.verify_voice_pin_hash(text, text) to service_role;
grant execute on function public.hash_voice_pin(text) to service_role;
grant execute on function public.auth_email_taken(text, uuid) to service_role;

create or replace function public.account_phone_digits(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) = 11
     and left(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 1) = '1'
      then right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)
    else regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  end;
$$;

create or replace function public.profiles_lock_phone_and_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_id uuid;
begin
  if public.account_phone_digits(old.phone) <> ''
     and public.account_phone_digits(new.phone) is distinct from public.account_phone_digits(old.phone) then
    if auth.role() is distinct from 'service_role' then
      raise exception 'phone_locked' using errcode = 'P0001';
    end if;
    select g.id into grant_id
    from public.account_contact_grants g
    where g.user_id = new.user_id
      and g.purpose = 'change_phone'
      and g.consumed_at is null
      and g.expires_at > now()
      and g.uses_left > 0
      and g.new_value = new.phone
    order by g.created_at desc
    limit 1;
    if grant_id is null then
      raise exception 'phone_locked' using errcode = 'P0001';
    end if;
    update public.account_contact_grants
      set uses_left = uses_left - 1,
          consumed_at = case when uses_left - 1 <= 0 then now() else consumed_at end
      where id = grant_id;
  end if;

  if new.voice_pin_hash is distinct from old.voice_pin_hash then
    if auth.role() is distinct from 'service_role' then
      raise exception 'pin_locked' using errcode = 'P0001';
    end if;
    select g.id into grant_id
    from public.account_contact_grants g
    where g.user_id = new.user_id
      and g.purpose = 'change_pin'
      and g.consumed_at is null
      and g.expires_at > now()
      and g.uses_left > 0
    order by g.created_at desc
    limit 1;
    if grant_id is null then
      raise exception 'pin_locked' using errcode = 'P0001';
    end if;
    update public.account_contact_grants
      set uses_left = uses_left - 1,
          consumed_at = case when uses_left - 1 <= 0 then now() else consumed_at end
      where id = grant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_lock_phone_and_pin on public.profiles;
create trigger trg_profiles_lock_phone_and_pin
  before update on public.profiles
  for each row
  execute function public.profiles_lock_phone_and_pin();

create or replace function public.pro_profiles_lock_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_id uuid;
begin
  if public.account_phone_digits(old.phone) <> ''
     and public.account_phone_digits(new.phone) is distinct from public.account_phone_digits(old.phone) then
    if auth.role() is distinct from 'service_role' then
      raise exception 'phone_locked' using errcode = 'P0001';
    end if;
    select g.id into grant_id
    from public.account_contact_grants g
    where g.user_id = new.user_id
      and g.purpose = 'change_phone'
      and g.consumed_at is null
      and g.expires_at > now()
      and g.uses_left > 0
      and g.new_value = new.phone
    order by g.created_at desc
    limit 1;
    if grant_id is null then
      raise exception 'phone_locked' using errcode = 'P0001';
    end if;
    update public.account_contact_grants
      set uses_left = uses_left - 1,
          consumed_at = case when uses_left - 1 <= 0 then now() else consumed_at end
      where id = grant_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pro_profiles_lock_phone on public.pro_profiles;
create trigger trg_pro_profiles_lock_phone
  before update on public.pro_profiles
  for each row
  execute function public.pro_profiles_lock_phone();

create or replace function public.auth_lock_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_id uuid;
  next_email text;
begin
  next_email := lower(btrim(coalesce(new.email, '')));
  if next_email = lower(btrim(coalesce(old.email, ''))) then
    return new;
  end if;
  select g.id into grant_id
  from public.account_contact_grants g
  where g.user_id = new.id
    and g.purpose = 'change_email'
    and g.consumed_at is null
    and g.expires_at > now()
    and g.uses_left > 0
    and lower(g.new_value) = next_email
  order by g.created_at desc
  limit 1;
  if grant_id is null then
    raise exception 'email_locked' using errcode = 'P0001';
  end if;
  update public.account_contact_grants
    set uses_left = uses_left - 1,
        consumed_at = case when uses_left - 1 <= 0 then now() else consumed_at end
    where id = grant_id;
  return new;
end;
$$;

drop trigger if exists trg_auth_lock_email_change on auth.users;
create trigger trg_auth_lock_email_change
  before update on auth.users
  for each row
  execute function public.auth_lock_email_change();
