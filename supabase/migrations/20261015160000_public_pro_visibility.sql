-- One visibility rule for public pro pages, listings and the sitemap.
-- Listed: verified, real (non-junk) business name, paid plan (starter/growth/pro, not hold),
-- owner not flagged is_test_account. The Rivera showcase demo stays viewable on its own page
-- (not listed / not in the sitemap). Owners and platform moderators can always view their page.

create or replace function public.pro_business_name_is_real(p_name text)
returns boolean language sql immutable set search_path = public, pg_temp as $$
  select case
    when n = '' or length(n) < 3 then false
    when n = any (array['john','dasdsadasd','test','testing','asdf','asdfasdf']) then false
    when n ~ '^(.)\1{4,}$' then false
    when n ~ '^[a-z]{10,}$' and length(regexp_replace(n, '[^aeiou]', '', 'g')) <= 2 then false
    else true end
  from (select lower(trim(coalesce(p_name, ''))) as n) s;
$$;

create or replace function public.pro_profile_is_listed(p_pro_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select pp.is_verified is true
       and public.pro_business_name_is_real(pp.business_name)
       and lower(coalesce(nullif(trim(s.plan_id), ''), pp.subscription_tier, '')) in ('starter','growth','pro')
       and coalesce(p.is_test_account, false) = false
    from public.pro_profiles pp
    left join public.profiles p on p.user_id = pp.user_id
    left join public.pro_subscriptions s on s.user_id = pp.user_id
    where pp.id = p_pro_profile_id
  ), false);
$$;

create or replace function public.pro_profile_is_public(p_pro_profile_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select pp.is_verified is true and (
         public.pro_profile_is_listed(pp.id)
      or trim(coalesce(pp.business_name, '')) = 'Rivera Home Services'
    )
    or (auth.uid() is not null and pp.user_id = auth.uid())
    or coalesce(public.auth_is_platform_moderator(), false)
    from public.pro_profiles pp where pp.id = p_pro_profile_id
  ), false);
$$;

create or replace function public.listed_pro_handles()
returns setof text language sql stable security definer set search_path = public, pg_temp as $$
  select lower(coalesce(p.username, pp.share_slug))
  from public.pro_profiles pp left join public.profiles p on p.user_id = pp.user_id
  where public.pro_profile_is_listed(pp.id) and coalesce(p.username, pp.share_slug) is not null
  order by 1;
$$;

create or replace function public.resolve_public_handle(p_handle text)
 returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
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
      if not public.pro_profile_is_public(pro_id) then
        return jsonb_build_object('status', 'not_found');
      end if;
      return jsonb_build_object('status', 'ok', 'kind', 'pro', 'username', prof.username, 'pro_profile_id', pro_id);
    end if;
    return jsonb_build_object(
      'status', 'ok', 'kind', 'member', 'username', prof.username,
      'first_name', nullif(split_part(trim(coalesce(prof.full_name, '')), ' ', 1), ''),
      'member_since', extract(year from prof.created_at)::int
    );
  end if;

  select pp.id, p.username into pro_id, target
  from public.pro_profiles pp left join public.profiles p on p.user_id = pp.user_id
  where lower(pp.share_slug) = h limit 1;
  if pro_id is not null then
    if not public.pro_profile_is_public(pro_id) then
      return jsonb_build_object('status', 'not_found');
    end if;
    return jsonb_build_object('status', 'redirect', 'username', target, 'pro_profile_id', pro_id);
  end if;

  select p.username into target
  from public.username_history uh join public.profiles p on p.user_id = uh.user_id
  where lower(uh.old_username) = h and p.username is not null
  order by uh.changed_at desc limit 1;
  if target is not null then
    return jsonb_build_object('status', 'redirect', 'username', target);
  end if;

  return jsonb_build_object('status', 'not_found');
end;
$function$;

revoke all on function public.pro_profile_is_listed(uuid) from public;
revoke all on function public.pro_profile_is_public(uuid) from public;
revoke all on function public.listed_pro_handles() from public;
grant execute on function public.pro_business_name_is_real(text) to anon, authenticated;
grant execute on function public.pro_profile_is_listed(uuid) to anon, authenticated;
grant execute on function public.pro_profile_is_public(uuid) to anon, authenticated;
grant execute on function public.listed_pro_handles() to anon, authenticated;
