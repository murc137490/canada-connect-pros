-- Availability helpers (RLS-safe) for live Member ID checks in the dashboard
create or replace function public.is_public_user_number_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  digits text;
begin
  if uid is null then return false; end if;
  digits := regexp_replace(coalesce(candidate, ''), '\D', '', 'g');
  if length(digits) < 4 or length(digits) > 5 then return false; end if;
  normalized := digits;
  return not exists (
    select 1 from public.profiles p
    where p.public_user_number = normalized and p.user_id <> uid
  );
end;
$$;

revoke all on function public.is_public_user_number_available(text) from public;
grant execute on function public.is_public_user_number_available(text) to authenticated;

create or replace function public.is_pro_member_id_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  my_pro uuid;
begin
  if uid is null then return false; end if;
  normalized := regexp_replace(coalesce(candidate, ''), '\D', '', 'g');
  if length(normalized) <> 4 then return false; end if;
  select id into my_pro from public.pro_profiles where user_id = uid limit 1;
  return not exists (
    select 1 from public.pro_profiles p
    where p.pro_member_id = normalized and (my_pro is null or p.id <> my_pro)
  );
end;
$$;

revoke all on function public.is_pro_member_id_available(text) from public;
grant execute on function public.is_pro_member_id_available(text) to authenticated;
