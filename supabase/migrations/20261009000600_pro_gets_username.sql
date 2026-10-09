-- Every pro has a public handle: when a pro row is written for an account without a username,
-- claim one (their chosen share link when free, else firstname+digits) and mirror it.
create or replace function public.pro_profiles_share_slug_from_username()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  uname text;
  cand text;
  seed text;
begin
  select p.username into uname from public.profiles p where p.user_id = new.user_id;
  if uname is null and exists (select 1 from public.profiles p where p.user_id = new.user_id) then
    cand := lower(trim(coalesce(new.share_slug, '')));
    if cand !~ '^[a-z][a-z0-9._-]{2,29}$'
       or public.username_is_reserved(cand)
       or exists (select 1 from public.profiles where lower(username) = cand)
       or exists (select 1 from public.pro_profiles where lower(share_slug) = cand and user_id <> new.user_id)
       or public.username_is_held_for_other(cand, new.user_id) then
      select coalesce(nullif(trim(p.full_name), ''), new.business_name) into seed
      from public.profiles p where p.user_id = new.user_id;
      cand := public.username_generate_unique(seed);
    end if;
    if cand is not null then
      begin
        update public.profiles set username = cand where user_id = new.user_id and username is null;
        uname := cand;
      exception when others then
        uname := null; -- never block saving the pro profile
      end;
    end if;
  end if;
  if uname is not null then
    new.share_slug := uname;
  end if;
  return new;
end;
$$;
