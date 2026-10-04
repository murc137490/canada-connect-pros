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
