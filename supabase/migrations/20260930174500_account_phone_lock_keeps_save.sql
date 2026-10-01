-- The current site still saves the phone with the rest of the profile.
-- Keep that save working: a browser update cannot change a phone that is
-- already on file, but it must not fail the whole profile update.
-- The account-security function uses the service role and still needs a code.

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
      new.phone := old.phone;
    else
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
      new.phone := old.phone;
    else
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
  end if;
  return new;
end;
$$;
