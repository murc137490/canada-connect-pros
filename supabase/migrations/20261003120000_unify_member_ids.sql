-- Keep a single public Member ID per account. pro_profiles.pro_member_id stays
-- as a compatibility mirror for existing professional phone workflows.

do $$
begin
  if exists (
    select 1
    from public.pro_profiles p
    left join public.profiles u on u.user_id = p.user_id
    where u.user_id is null or u.public_user_number is null
  ) then
    raise exception 'Cannot unify Member IDs: every professional must have a profile Member ID';
  end if;
end;
$$;

-- Profile IDs are the canonical namespace. Rebuild the mirror index while
-- syncing existing professional rows to those same account IDs.
drop index if exists public.pro_profiles_pro_member_id_uidx;

update public.pro_profiles p
set pro_member_id = u.public_user_number,
    updated_at = now()
from public.profiles u
where u.user_id = p.user_id
  and p.pro_member_id is distinct from u.public_user_number;

create unique index pro_profiles_pro_member_id_uidx
  on public.pro_profiles (pro_member_id);

create or replace function public.pro_profiles_assign_pro_member_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_member_id text;
begin
  select u.public_user_number
  into account_member_id
  from public.profiles u
  where u.user_id = new.user_id;

  if account_member_id is null then
    raise exception 'A profile Member ID is required before creating a professional profile';
  end if;

  new.pro_member_id := account_member_id;
  return new;
end;
$$;

drop trigger if exists trg_pro_profiles_assign_pro_member_id on public.pro_profiles;
create trigger trg_pro_profiles_assign_pro_member_id
  before insert or update on public.pro_profiles
  for each row
  execute function public.pro_profiles_assign_pro_member_id();

create or replace function public.sync_pro_member_id_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_user_number is distinct from old.public_user_number then
    update public.pro_profiles
    set pro_member_id = new.public_user_number,
        updated_at = now()
    where user_id = new.user_id
      and pro_member_id is distinct from new.public_user_number;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_pro_member_id on public.profiles;
create trigger trg_profiles_sync_pro_member_id
  after update of public_user_number on public.profiles
  for each row
  execute function public.sync_pro_member_id_from_profile();

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
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  normalized := regexp_replace(coalesce(new_number, ''), '\D', '', 'g');
  if length(normalized) <> 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  select u.public_user_number
  into current_num
  from public.profiles u
  where u.user_id = uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;

  if exists (
    select 1 from public.profiles u
    where u.public_user_number = normalized and u.user_id <> uid
  ) or exists (
    select 1 from public.pro_profiles p
    where p.pro_member_id = normalized and p.user_id <> uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  update public.profiles
  set public_user_number = normalized,
      updated_at = now()
  where user_id = uid
    and public_user_number is distinct from normalized;

  -- Also repairs the compatibility mirror if it was ever out of sync.
  update public.pro_profiles
  set pro_member_id = normalized,
      updated_at = now()
  where user_id = uid
    and pro_member_id is distinct from normalized;

  return jsonb_build_object(
    'ok', true,
    'public_user_number', normalized,
    'previous', current_num,
    'unchanged', current_num = normalized
  );
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
  if uid is null or length(normalized) <> 4 or normalized = '3177' then
    return false;
  end if;

  return not exists (
    select 1 from public.profiles u
    where u.public_user_number = normalized and u.user_id <> uid
  ) and not exists (
    select 1 from public.pro_profiles p
    where p.pro_member_id = normalized and p.user_id <> uid
  );
end;
$$;

-- Keep the old RPC callable for older clients, but route it through the shared
-- account ID so it cannot create a second, divergent professional ID.
create or replace function public.change_my_pro_member_id(new_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  if not exists (select 1 from public.pro_profiles p where p.user_id = uid) then
    return jsonb_build_object('ok', false, 'error', 'not_a_pro');
  end if;

  result := public.change_my_public_user_number(new_number);
  if coalesce((result->>'ok')::boolean, false) then
    result := result || jsonb_build_object('pro_member_id', result->'public_user_number');
  end if;
  return result;
end;
$$;

create or replace function public.is_pro_member_id_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.pro_profiles p where p.user_id = auth.uid()
  ) then
    return false;
  end if;
  return public.is_public_user_number_available(candidate);
end;
$$;

revoke all on function public.change_my_public_user_number(text) from public;
grant execute on function public.change_my_public_user_number(text) to authenticated;
revoke all on function public.is_public_user_number_available(text) from public;
grant execute on function public.is_public_user_number_available(text) to authenticated;
revoke all on function public.change_my_pro_member_id(text) from public;
grant execute on function public.change_my_pro_member_id(text) to authenticated;
revoke all on function public.is_pro_member_id_available(text) from public;
grant execute on function public.is_pro_member_id_available(text) to authenticated;

comment on column public.pro_profiles.pro_member_id is
  'Compatibility mirror of profiles.public_user_number; one Member ID identifies the account in both client and professional workflows.';
