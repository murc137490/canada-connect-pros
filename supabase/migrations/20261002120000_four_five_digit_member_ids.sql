-- Customer/staff Member IDs are exactly four digits. 3177 is reserved for
-- the super-admin; allocation fails once the remaining namespace is exhausted.

create or replace function public.allocate_public_user_number()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  num text;
  start_num int;
  candidate int;
  offset_num int;
begin
  -- Preserve leading-zero IDs and scan all four-digit values.
  start_num := 1000 + floor(random() * 9000)::int;
  for offset_num in 0..8999 loop
    candidate := 1000 + ((start_num - 1000 + offset_num) % 9000);
    num := candidate::text;
    if not exists (select 1 from public.profiles p where p.public_user_number = num)
       and num <> '3177' then
      return num;
    end if;
  end loop;
  raise exception 'Four-digit Member ID namespace exhausted';
end;
$$;

create or replace function public.profiles_assign_public_user_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_user_number is not null and length(trim(new.public_user_number)) > 0 then
    return new;
  end if;
  new.public_user_number := public.allocate_public_user_number();
  return new;
end;
$$;

-- Free the unique namespace before assigning new values; reserve 3177 for the
-- super-admin and reassign every account to four digits.
create temporary table _old_public_user_numbers on commit drop as
select user_id, public_user_number as old_number from public.profiles;

alter table public.platform_admin_staff
  drop constraint if exists platform_admin_staff_member_id_format;
alter table public.profiles
  drop constraint if exists profiles_public_user_number_format_check;

update public.profiles
set public_user_number = 'pending-' || user_id::text;

update public.platform_admin_staff
set member_id = 'pending-' || user_id::text;

do $$
declare
  r record;
  next_id text;
begin
  for r in select user_id, old_number from _old_public_user_numbers order by user_id loop
    if exists (
      select 1 from auth.users u
      where u.id = r.user_id and lower(u.email) = 'murc137490@gmail.com'
    ) then
      next_id := '3177';
    else
      next_id := null;
      if r.old_number ~ '^[0-9]{4}$'
         and r.old_number <> '3177'
         and not exists (select 1 from public.profiles p where p.public_user_number = r.old_number) then
        next_id := r.old_number;
      end if;
      if next_id is null
         or (next_id = '3177' and exists (
           select 1 from auth.users u where lower(u.email) = 'murc137490@gmail.com'
         ))
         or exists (select 1 from public.profiles p where p.public_user_number = next_id) then
        next_id := public.allocate_public_user_number();
      end if;
    end if;
    update public.profiles set public_user_number = next_id where user_id = r.user_id;
  end loop;

  update public.platform_admin_staff s
  set member_id = p.public_user_number
  from public.profiles p
  where p.user_id = s.user_id;

  for r in
    select user_id from public.platform_admin_staff where member_id like 'pending-%' order by user_id
  loop
    loop
      next_id := public.allocate_public_user_number();
      exit when not exists (
        select 1 from public.platform_admin_staff s where s.member_id = next_id
      );
    end loop;
    update public.platform_admin_staff set member_id = next_id where user_id = r.user_id;
  end loop;
end $$;

alter table public.platform_admin_staff
  add constraint platform_admin_staff_member_id_format
  check (member_id ~ '^[0-9]{4}$');

alter table public.profiles
  add constraint profiles_public_user_number_format_check
  check (public_user_number is null or public_user_number ~ '^[0-9]{4}$');

alter table public.profiles
  add column if not exists voice_pin_failed_attempts integer not null default 0,
  add column if not exists voice_pin_locked_until timestamptz;

comment on column public.profiles.voice_pin_failed_attempts is
  'Consecutive failed Front Desk keypad PIN attempts; reset on successful verification.';
comment on column public.profiles.voice_pin_locked_until is
  'Temporary Front Desk voice PIN lockout after repeated failed attempts.';

comment on column public.profiles.public_user_number is
  'Unique four-digit display Member ID; authentication uses the account UUID.';

-- Voice callers may speak Spanish or Arabic without those being offered as
-- menu choices. Store the detected spoken language for the session.
alter table public.front_desk_sessions
  drop constraint if exists front_desk_sessions_language_check;
alter table public.front_desk_sessions
  add constraint front_desk_sessions_language_check
  check (language in ('en', 'fr', 'es', 'ar'));
alter table public.front_desk_sessions
  drop constraint if exists front_desk_sessions_flow_check;
alter table public.front_desk_sessions
  add constraint front_desk_sessions_flow_check
  check (flow is null or flow in ('new_booking', 'existing_booking', 'pin_setup'));

create or replace function public.change_my_public_user_number(new_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  current_num text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  normalized := regexp_replace(coalesce(new_number, ''), '\D', '', 'g');
  if length(normalized) <> 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;
  select public_user_number into current_num from public.profiles where user_id = uid;
  if current_num is null then return jsonb_build_object('ok', false, 'error', 'profile_missing'); end if;
  if current_num = normalized then return jsonb_build_object('ok', true, 'public_user_number', normalized, 'unchanged', true); end if;
  if exists (select 1 from public.profiles where public_user_number = normalized and user_id <> uid) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;
  update public.profiles set public_user_number = normalized, updated_at = now() where user_id = uid;
  return jsonb_build_object('ok', true, 'public_user_number', normalized, 'previous', current_num);
end;
$$;

create or replace function public.is_public_user_number_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text := regexp_replace(coalesce(candidate, ''), '\D', '', 'g');
begin
  if uid is null or length(normalized) <> 4 or normalized = '3177' then return false; end if;
  return not exists (
    select 1 from public.profiles p where p.public_user_number = normalized and p.user_id <> uid
  );
end;
$$;

revoke all on function public.change_my_public_user_number(text) from public;
grant execute on function public.change_my_public_user_number(text) to authenticated;
revoke all on function public.is_public_user_number_available(text) from public;
grant execute on function public.is_public_user_number_available(text) to authenticated;

create or replace function public.front_desk_find_user_by_phone(p_phone text)
returns table(user_id uuid, full_name text, phone text, public_user_number text, has_pin boolean)
language sql
security definer
set search_path = public
stable
as $$
  with wanted as (
    select right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10) as digits
  )
  select p.user_id, p.full_name, p.phone, p.public_user_number,
         coalesce(length(p.voice_pin_hash) > 0, false)
  from public.profiles p, wanted w
  where length(w.digits) = 10
    and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 10) = w.digits
  order by p.created_at nulls last
  limit 2;
$$;

create or replace function public.set_front_desk_voice_pin(p_user_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare cleaned text := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
begin
  if p_user_id is null or cleaned !~ '^[0-9]{4,6}$' then return false; end if;
  update public.profiles
  set voice_pin_hash = extensions.crypt(cleaned, extensions.gen_salt('bf')),
      updated_at = now()
  where user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.front_desk_find_user_by_phone(text) from public, anon, authenticated;
grant execute on function public.front_desk_find_user_by_phone(text) to service_role;
revoke all on function public.set_front_desk_voice_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.set_front_desk_voice_pin(uuid, text) to service_role;
