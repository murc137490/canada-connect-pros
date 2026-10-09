-- Vanity public links: https://www.altshift.ca/<username>
-- * username is the single public handle (pros + clients); pro_profiles.share_slug mirrors it
-- * reserved list covers every top-level app route + file-like names
-- * username_history: old names redirect to the current one; held 90 days for the owner
-- * backfill usernames for pros (keeps their existing share link when valid)

-- 1) Reserved names -----------------------------------------------------------
create or replace function public.username_is_reserved(p_username text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select lower(coalesce(p_username, '')) in (
    -- original list
    'admin', 'administrator', 'altshift', 'alt-shift', 'alt.shift', 'support', 'help',
    'root', 'system', 'staff', 'moderator', 'security', 'billing', 'info', 'contact',
    'noreply', 'no-reply', 'null', 'undefined', 'anonymous', 'service', 'services',
    -- every top-level route in src/App.tsx (and close variants)
    'pros', 'pro', 'join-pros', 'pro-plans', 'create-pro-account', 'pro-onboarding',
    'dashboard', 'make-request', 'front-desk', 'about', 'a-propos', 'get-app',
    'terms', 'privacy', 'privacy-policy', 'politique-de-confidentialite', 'cookies',
    'cookie-policy', 'phone-preview', 'reset-password', 'book-again', 'unsubscribe',
    'confirm-deletion', 'pay', 'auth', 'login', 'logout', 'signin', 'signup', 'sign-in',
    'sign-up', 'register', 'search', 'api', 'assets', 'static', 'public', 'well-known',
    'favicon', 'robots', 'sitemap', 'manifest', 'index', 'home', 'settings', 'account',
    'accounts', 'profile', 'profiles', 'user', 'users', 'me', 'new', 'edit', 'blog',
    'careers', 'jobs', 'job', 'whats-new', 'news', 'invite', 'invites', 'ref', 'referral',
    'app', 'apps', 'www', 'mail', 'email', 'legal', 'faq', 'guide', 'pricing', 'plans',
    'checkout', 'booking', 'bookings', 'messages', 'notifications', 'reviews', 'invoices',
    'favorites', 'categories', 'category', 'sw', 'offline', 'status', 'not-found', '404'
  )
  -- names that look like files would collide with static assets
  or lower(coalesce(p_username, '')) ~ '\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|txt|xml|json|webmanifest|html?|pdf|zip)$';
$$;

-- 2) History table ------------------------------------------------------------
create table if not exists public.username_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_username text not null,
  changed_at timestamptz not null default now()
);
create index if not exists username_history_old_idx on public.username_history (lower(old_username), changed_at desc);
create index if not exists username_history_user_idx on public.username_history (user_id);
alter table public.username_history enable row level security;
revoke all on public.username_history from anon, authenticated;
grant select on public.username_history to authenticated;
drop policy if exists "Users read own username history" on public.username_history;
create policy "Users read own username history" on public.username_history
  for select to authenticated using (auth.uid() = user_id);

-- 3) Held-name check inside the existing normalize trigger --------------------
create or replace function public.profiles_normalize_username()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  privileged boolean := coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (auth.uid() is null and current_user in ('postgres', 'supabase_admin'));
begin
  if new.username is null then
    return new;
  end if;
  new.username := nullif(lower(trim(new.username)), '');
  if new.username is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.username = lower(coalesce(old.username, '')) then
    return new;
  end if;
  if public.username_is_reserved(new.username) and not privileged then
    raise exception 'username_reserved' using errcode = '22023';
  end if;
  -- An old name stays with its previous owner for 90 days (their old links keep redirecting).
  if not privileged and exists (
    select 1 from public.username_history h
    where lower(h.old_username) = new.username
      and h.user_id <> new.user_id
      and h.changed_at > now() - interval '90 days'
  ) then
    raise exception 'username_held' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 4) After a username change: record history + mirror into pro share link -----
create or replace function public.profiles_username_changed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.username is not distinct from old.username then
    return null;
  end if;
  if old.username is not null then
    insert into public.username_history (user_id, old_username) values (new.user_id, lower(old.username));
  end if;
  if new.username is not null then
    update public.pro_profiles
       set share_slug = new.username
     where user_id = new.user_id
       and share_slug is distinct from new.username;
  end if;
  return null;
end;
$$;
revoke all on function public.profiles_username_changed() from public, anon, authenticated;

drop trigger if exists trg_profiles_username_changed on public.profiles;
create trigger trg_profiles_username_changed
  after update of username on public.profiles
  for each row execute function public.profiles_username_changed();

-- pro_profiles.share_slug always follows the owner's username when one exists
create or replace function public.pro_profiles_share_slug_from_username()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uname text;
begin
  select p.username into uname from public.profiles p where p.user_id = new.user_id;
  if uname is not null then
    new.share_slug := uname;
  end if;
  return new;
end;
$$;
revoke all on function public.pro_profiles_share_slug_from_username() from public, anon, authenticated;

drop trigger if exists trg_pro_profiles_share_slug_from_username on public.pro_profiles;
create trigger trg_pro_profiles_share_slug_from_username
  before insert or update of share_slug, user_id on public.pro_profiles
  for each row execute function public.pro_profiles_share_slug_from_username();

-- 5) Unique username generator (firstname + digits, e.g. john57) ---------------
create or replace function public.username_generate_unique(p_seed text)
returns text
language plpgsql
volatile
set search_path to 'public', 'pg_temp'
as $$
declare
  base text := public.username_slug(split_part(trim(coalesce(p_seed, '')), ' ', 1));
  candidate text;
  i int := 0;
begin
  base := regexp_replace(coalesce(base, ''), '[._-]+$', '');
  if base is null or length(base) < 3 or public.username_is_reserved(base) then
    base := 'member';
  end if;
  base := left(base, 24);
  while i < 60 loop
    candidate := base || (case when i < 30 then (10 + floor(random() * 90))::int else (100 + floor(random() * 9900))::int end)::text;
    i := i + 1;
    if candidate ~ '^[a-z][a-z0-9._-]{2,29}$'
       and not public.username_is_reserved(candidate)
       and not exists (select 1 from public.profiles where lower(username) = candidate)
       and not exists (select 1 from public.pro_profiles where lower(share_slug) = candidate)
       and not exists (select 1 from public.username_history where lower(old_username) = candidate) then
      return candidate;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.username_generate_unique(text) from public, anon, authenticated;

-- 6) Public resolver -----------------------------------------------------------
create or replace function public.resolve_public_handle(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  h text := lower(trim(coalesce(p_handle, '')));
  prof record;
  pro_id uuid;
  target text;
begin
  if h !~ '^[a-z][a-z0-9._-]{2,29}$' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select p.user_id, p.username, p.full_name, p.created_at into prof
  from public.profiles p where lower(p.username) = h;
  if found then
    select pp.id into pro_id from public.pro_profiles pp where pp.user_id = prof.user_id limit 1;
    if pro_id is not null then
      return jsonb_build_object('status', 'ok', 'kind', 'pro', 'username', prof.username, 'pro_profile_id', pro_id);
    end if;
    -- Clients: first name + member-since year only (no photo, last name, location or contact).
    return jsonb_build_object(
      'status', 'ok', 'kind', 'member', 'username', prof.username,
      'first_name', nullif(split_part(trim(coalesce(prof.full_name, '')), ' ', 1), ''),
      'member_since', extract(year from prof.created_at)::int
    );
  end if;

  -- Legacy share link that no longer matches the username
  select pp.id, p.username into pro_id, target
  from public.pro_profiles pp left join public.profiles p on p.user_id = pp.user_id
  where lower(pp.share_slug) = h limit 1;
  if pro_id is not null then
    return jsonb_build_object('status', 'redirect', 'username', target, 'pro_profile_id', pro_id);
  end if;

  -- Old username -> owner's current username (only while nobody else owns it; checked above)
  select p.username into target
  from public.username_history uh join public.profiles p on p.user_id = uh.user_id
  where lower(uh.old_username) = h and p.username is not null
  order by uh.changed_at desc limit 1;
  if target is not null then
    return jsonb_build_object('status', 'redirect', 'username', target);
  end if;

  return jsonb_build_object('status', 'not_found');
end;
$$;
revoke all on function public.resolve_public_handle(text) from public;
grant execute on function public.resolve_public_handle(text) to anon, authenticated, service_role;

-- 7) Live availability check for the settings form --------------------------
create or replace function public.username_available(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uid uuid := auth.uid();
  n text := lower(trim(coalesce(p_username, '')));
begin
  if uid is null then
    return jsonb_build_object('available', false, 'reason', 'not_authenticated');
  end if;
  if n !~ '^[a-z][a-z0-9._-]{2,29}$' then
    return jsonb_build_object('available', false, 'reason', 'invalid_format');
  end if;
  if exists (select 1 from public.profiles where user_id = uid and lower(username) = n) then
    return jsonb_build_object('available', true, 'reason', 'current');
  end if;
  if public.username_is_reserved(n) then
    return jsonb_build_object('available', false, 'reason', 'reserved');
  end if;
  if exists (select 1 from public.profiles where lower(username) = n and user_id <> uid)
     or exists (select 1 from public.pro_profiles where lower(share_slug) = n and user_id <> uid) then
    return jsonb_build_object('available', false, 'reason', 'taken');
  end if;
  if exists (select 1 from public.username_history where lower(old_username) = n and user_id <> uid
             and changed_at > now() - interval '90 days') then
    return jsonb_build_object('available', false, 'reason', 'held');
  end if;
  return jsonb_build_object('available', true, 'reason', 'free');
end;
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated, service_role;

-- 8) set_my_username: same checks, plus held names and legacy share links -------
create or replace function public.set_my_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
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

  select username into current_value from public.profiles where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;
  if current_value = normalized then
    return jsonb_build_object('ok', true, 'username', normalized, 'unchanged', true);
  end if;
  if public.username_is_reserved(normalized) then
    return jsonb_build_object('ok', false, 'error', 'reserved');
  end if;
  if exists (select 1 from public.profiles where lower(username) = normalized and user_id <> uid)
     or exists (select 1 from public.pro_profiles where lower(share_slug) = normalized and user_id <> uid) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  if exists (select 1 from public.username_history where lower(old_username) = normalized and user_id <> uid
             and changed_at > now() - interval '90 days') then
    return jsonb_build_object('ok', false, 'error', 'held');
  end if;

  begin
    update public.profiles set username = normalized, updated_at = now() where user_id = uid;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'taken');
    when sqlstate '22023' then
      return jsonb_build_object('ok', false, 'error', case when sqlerrm = 'username_held' then 'held' else 'reserved' end);
  end;
  return jsonb_build_object('ok', true, 'username', normalized);
end;
$$;

-- 9) Backfill pros without a username: keep their current share link when valid
do $$
declare
  r record;
  cand text;
begin
  for r in
    select p.user_id, p.full_name, pp.share_slug, pp.business_name
    from public.profiles p
    join public.pro_profiles pp on pp.user_id = p.user_id
    where p.username is null
    order by pp.created_at
  loop
    cand := lower(trim(coalesce(r.share_slug, '')));
    if cand !~ '^[a-z][a-z0-9._-]{2,29}$'
       or public.username_is_reserved(cand)
       or exists (select 1 from public.profiles where lower(username) = cand) then
      cand := public.username_generate_unique(coalesce(nullif(trim(r.full_name), ''), r.business_name));
    end if;
    if cand is not null then
      update public.profiles set username = cand where user_id = r.user_id and username is null;
    end if;
  end loop;
end $$;
