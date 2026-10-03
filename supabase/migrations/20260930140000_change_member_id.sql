-- Allow users to change their Member ID (profiles.public_user_number) if free.
-- Old ID is released automatically on update (unique index).

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
  if length(normalized) < 4 or length(normalized) > 5 then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  select p.public_user_number into current_num
  from public.profiles p
  where p.user_id = uid;

  if current_num is null then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;

  if current_num = normalized then
    return jsonb_build_object('ok', true, 'public_user_number', normalized, 'unchanged', true);
  end if;

  if exists (
    select 1 from public.profiles p
    where p.public_user_number = normalized and p.user_id <> uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  update public.profiles
  set public_user_number = normalized, updated_at = now()
  where user_id = uid;

  return jsonb_build_object('ok', true, 'public_user_number', normalized, 'previous', current_num);
end;
$$;

revoke all on function public.change_my_public_user_number(text) from public;
grant execute on function public.change_my_public_user_number(text) to authenticated;

-- Pros: change 4-digit pro_member_id if free
create or replace function public.change_my_pro_member_id(new_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  current_num text;
  pid uuid;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  normalized := regexp_replace(coalesce(new_number, ''), '\D', '', 'g');
  if length(normalized) <> 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_format');
  end if;

  select p.id, p.pro_member_id into pid, current_num
  from public.pro_profiles p
  where p.user_id = uid
  limit 1;

  if pid is null then
    return jsonb_build_object('ok', false, 'error', 'not_a_pro');
  end if;

  if current_num = normalized then
    return jsonb_build_object('ok', true, 'pro_member_id', normalized, 'unchanged', true);
  end if;

  if exists (
    select 1 from public.pro_profiles p
    where p.pro_member_id = normalized and p.id <> pid
  ) then
    return jsonb_build_object('ok', false, 'error', 'taken');
  end if;

  update public.pro_profiles
  set pro_member_id = normalized, updated_at = now()
  where id = pid;

  return jsonb_build_object('ok', true, 'pro_member_id', normalized, 'previous', current_num);
end;
$$;

revoke all on function public.change_my_pro_member_id(text) from public;
grant execute on function public.change_my_pro_member_id(text) to authenticated;
