-- Login by Member ID or username (2026-10-08)
-- DO NOT apply from the app agent — owner applies via Supabase SQL editor / CLI.
--
-- 1) profiles.username: optional, lowercase, case-insensitive unique. Existing
--    rows stay NULL (those members keep logging in with their Member ID and can
--    pick a username in My Account). New signups get the username they chose,
--    or an auto-generated one, assigned AFTER the profile row exists so a
--    username problem can never block account creation.
-- 2) public.login_attempts + throttle RPCs for the login-with-identifier edge
--    function (per-identifier and per-IP brute-force protection). Hashes only;
--    no raw IPs or identifiers are stored.
-- 3) set_my_username RPC for the My Account screen.

-- ---------------------------------------------------------------------------
-- 1. Username column
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username text;

-- Normalize any pre-existing values (column existed in an older schema).
update public.profiles
set username = null
where username is not null
  and lower(trim(username)) !~ '^[a-z][a-z0-9._-]{2,29}$';

update public.profiles
set username = lower(trim(username))
where username is not null
  and username <> lower(trim(username));

-- If legacy duplicates exist (case-insensitive), keep the oldest and clear the rest.
with ranked as (
  select user_id,
         row_number() over (partition by lower(username) order by created_at, user_id) as rn
  from public.profiles
  where username is not null
)
update public.profiles p
set username = null
from ranked r
where r.user_id = p.user_id and r.rn > 1;

alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles
  add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z][a-z0-9._-]{2,29}$');

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

comment on column public.profiles.username is
  'Optional login username: lowercase, 3-30 chars, starts with a letter, [a-z0-9._-]. Case-insensitive unique. Never all digits, so it cannot collide with a Member ID.';

-- Anon must never read usernames (only display columns are granted to anon).
revoke select (username) on table public.profiles from anon;

create or replace function public.username_is_reserved(p_username text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(coalesce(p_username, '')) in (
    'admin', 'administrator', 'altshift', 'alt-shift', 'alt.shift', 'support', 'help',
    'root', 'system', 'staff', 'moderator', 'security', 'billing', 'info', 'contact',
    'noreply', 'no-reply', 'null', 'undefined', 'anonymous', 'service', 'services'
  );
$$;

-- Normalize on direct writes (PostgREST updates by the owner) and block reserved names.
create or replace function public.profiles_normalize_username()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.username is null then
    return new;
  end if;
  new.username := nullif(lower(trim(new.username)), '');
  if new.username is not null and public.username_is_reserved(new.username) then
    raise exception 'username_reserved' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_username on public.profiles;
create trigger trg_profiles_normalize_username
  before insert or update of username on public.profiles
  for each row
  execute function public.profiles_normalize_username();

-- Turn free text (a requested username or a full name) into a valid base.
create or replace function public.username_slug(p_raw text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select left(
    regexp_replace(
      regexp_replace(
        translate(
          lower(trim(coalesce(p_raw, ''))),
          'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ ',
          'aaaaaaceeeeiiiinooooouuuuyyoa.'
        ),
        '[^a-z0-9._-]+', '', 'g'
      ),
      '^[^a-z]+', '', 'g'
    ),
    24
  );
$$;

-- Assign a username right after a profile row is created. Never raises.
create or replace function public.profiles_assign_username_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested text;
  base text;
  candidate text;
  attempt int := 0;
begin
  if new.username is not null then
    return null;
  end if;

  begin
    select nullif(lower(trim(u.raw_user_meta_data ->> 'username')), '')
    into requested
    from auth.users u
    where u.id = new.user_id;
  exception when others then
    requested := null;
  end;

  if requested is not null
     and requested ~ '^[a-z][a-z0-9._-]{2,29}$'
     and not public.username_is_reserved(requested) then
    base := requested;
  else
    -- Requested name unusable: try its slug, then the full name, then "member".
    base := public.username_slug(coalesce(requested, ''));
    if base is null or length(base) < 3 or public.username_is_reserved(base) then
      base := public.username_slug(coalesce(new.full_name, ''));
    end if;
    if base is null or length(base) < 3 or public.username_is_reserved(base) then
      base := 'member';
    end if;
  end if;

  while attempt < 25 loop
    if attempt = 0 then
      candidate := base;
    else
      candidate := left(base, 24) || (10 + floor(random() * 9990))::int::text;
    end if;
    attempt := attempt + 1;
    if candidate !~ '^[a-z][a-z0-9._-]{2,29}$' or public.username_is_reserved(candidate) then
      continue;
    end if;
    begin
      update public.profiles
      set username = candidate
      where user_id = new.user_id
        and username is null;
      return null;
    exception
      when unique_violation then
        null; -- try another suffix
      when others then
        return null; -- never block signup
    end;
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_profiles_assign_username on public.profiles;
create trigger trg_profiles_assign_username
  after insert on public.profiles
  for each row
  execute function public.profiles_assign_username_after_insert();

-- Signed-in members can pick or change their username.
create or replace function public.set_my_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  normalized text := nullif(lower(trim(coalesce(p_username, ''))), '');
  current_value text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if normalized is null or normalized !~ '^[a-z][a-z0-9._-]{2,29}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;
  if public.username_is_reserved(normalized) then
    return jsonb_build_object('ok', false, 'error', 'reserved');
  end if;

  select username into current_value from public.profiles where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;
  if current_value = normalized then
    return jsonb_build_object('ok', true, 'username', normalized, 'unchanged', true);
  end if;
  if exists (
    select 1 from public.profiles
    where lower(username) = normalized and user_id <> uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  begin
    update public.profiles set username = normalized, updated_at = now() where user_id = uid;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end;
  return jsonb_build_object('ok', true, 'username', normalized);
end;
$$;

revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated;
revoke all on function public.profiles_assign_username_after_insert() from public, anon, authenticated;
revoke all on function public.profiles_normalize_username() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Login throttle
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  identifier_hash text not null,
  success boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists login_attempts_identifier_idx
  on public.login_attempts (identifier_hash, attempted_at desc);
create index if not exists login_attempts_ip_idx
  on public.login_attempts (ip_hash, attempted_at desc);
create index if not exists login_attempts_attempted_at_idx
  on public.login_attempts (attempted_at);

alter table public.login_attempts enable row level security;
-- No policies: only the service role (edge function) touches this table.
revoke all on table public.login_attempts from public, anon, authenticated;
grant select, insert, delete on table public.login_attempts to service_role;

comment on table public.login_attempts is
  'Hashed (HMAC) login attempt log for login-with-identifier rate limiting. No raw IPs, identifiers or emails.';

create or replace function public.login_throttle_check(
  p_ip_hash text,
  p_identifier_hash text,
  p_window_seconds integer default 900
)
returns table (ip_attempts integer, ip_failures integer, identifier_failures integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*)::int from public.login_attempts
      where ip_hash = p_ip_hash
        and attempted_at > now() - make_interval(secs => p_window_seconds)),
    (select count(*)::int from public.login_attempts
      where ip_hash = p_ip_hash and not success
        and attempted_at > now() - make_interval(secs => p_window_seconds)),
    (select count(*)::int from public.login_attempts
      where identifier_hash = p_identifier_hash and not success
        and attempted_at > now() - make_interval(secs => p_window_seconds));
$$;

create or replace function public.login_throttle_record(
  p_ip_hash text,
  p_identifier_hash text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.login_attempts (ip_hash, identifier_hash, success)
  values (p_ip_hash, p_identifier_hash, coalesce(p_success, false));

  if coalesce(p_success, false) then
    -- A correct password clears that identifier's failure streak.
    delete from public.login_attempts
    where identifier_hash = p_identifier_hash and not success;
  end if;

  -- Opportunistic cleanup; keeps the table tiny without pg_cron.
  delete from public.login_attempts
  where id in (
    select id from public.login_attempts
    where attempted_at < now() - interval '1 day'
    order by attempted_at
    limit 500
  );
end;
$$;

revoke all on function public.login_throttle_check(text, text, integer) from public, anon, authenticated;
revoke all on function public.login_throttle_record(text, text, boolean) from public, anon, authenticated;
grant execute on function public.login_throttle_check(text, text, integer) to service_role;
grant execute on function public.login_throttle_record(text, text, boolean) to service_role;
