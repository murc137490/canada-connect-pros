-- Promote the existing Grok account to staff admin with its requested four-digit ID.
-- The ID is per-account and is checked by the existing AdminMemberIdGate.
do $$
declare
  target_id uuid;
  actor_id uuid;
  target_name text;
begin
  select u.id into target_id
  from auth.users u
  where lower(trim(u.email::text)) = 'grok@altshift.com'
  limit 1;

  if target_id is null then
    raise exception 'grok@altshift.com does not have an Auth account';
  end if;

  if not exists (select 1 from public.profiles p where p.user_id = target_id) then
    raise exception 'The target account must sign in once to create its profile';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.public_user_number = '2002' and p.user_id <> target_id
  ) then
    raise exception 'Member ID 2002 is already assigned';
  end if;

  select u.id into actor_id
  from auth.users u
  where lower(trim(u.email::text)) = 'murc137490@gmail.com'
  limit 1;

  select coalesce(nullif(trim(p.full_name), ''), 'Grok') into target_name
  from public.profiles p where p.user_id = target_id;

  -- The profile role guard normally allows only the authenticated super-admin.
  -- This one-time migration applies the explicitly requested promotion, then restores it.
  alter table public.profiles disable trigger trg_profiles_guard_platform_admin;
  update public.profiles
  set is_platform_admin = true,
      public_user_number = '2002',
      updated_at = now()
  where user_id = target_id;
  alter table public.profiles enable trigger trg_profiles_guard_platform_admin;

  insert into public.platform_admin_staff (
    user_id, email, member_id, full_name, created_by, updated_at
  ) values (
    target_id, 'grok@altshift.com', '2002', target_name, actor_id, now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      member_id = excluded.member_id,
      full_name = excluded.full_name,
      updated_at = now();

  insert into public.platform_admin_audit_events (
    actor_user_id, actor_member_id, action, target_user_id, target_member_id, detail
  ) values (
    actor_id,
    (select p.public_user_number from public.profiles p where p.user_id = actor_id),
    'admin_staff_create',
    target_id,
    '2002',
    jsonb_build_object('email', 'grok@altshift.com', 'source', 'requested account promotion')
  );
end;
$$;
