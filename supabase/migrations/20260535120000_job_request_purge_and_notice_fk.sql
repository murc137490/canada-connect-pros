-- Fix moderation notices FK (client_id must exist on profiles, not only auth.users).
-- Purge job requests older than 7 days (deleted entirely from DB).

alter table public.job_request_moderation_notices
  drop constraint if exists job_request_moderation_notices_user_id_fkey;

alter table public.job_request_moderation_notices
  add constraint job_request_moderation_notices_user_id_fkey
  foreign key (user_id) references public.profiles (user_id) on delete cascade;

create or replace function public.purge_job_requests_older_than_seven_days()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with deleted as (
    delete from public.job_requests
    where created_at < now() - interval '7 days'
    returning id
  )
  select count(*)::integer into n from deleted;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.purge_job_requests_older_than_seven_days() from public;
grant execute on function public.purge_job_requests_older_than_seven_days() to authenticated;

create or replace function public.moderate_job_request_admin(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_req public.job_requests%rowtype;
  v_strikes int;
  v_title text;
  v_body text;
  v_rules text;
  v_strike_after int;
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason not in ('inappropriate', 'suspicious', 'redo') then
    raise exception 'INVALID_REASON';
  end if;

  perform public.purge_job_requests_older_than_seven_days();

  select * into v_req from public.job_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if not exists (select 1 from public.profiles p where p.user_id = v_req.client_id) then
    raise exception 'CLIENT_PROFILE_NOT_FOUND';
  end if;

  update public.job_requests
  set
    status = 'removed',
    moderation_reason = p_reason,
    moderation_removed_at = now(),
    moderation_removed_by = auth.uid(),
    updated_at = now()
  where id = p_request_id;

  v_rules :=
    'Allowed: licensed home services (plumbing, HVAC, cleaning, handyman, moving, assembly, etc.). '
    || 'Not allowed: anything illegal; adult/sexual services; weapons; drugs; gambling; '
    || 'unlicensed electrical/gas work; asbestos/lead abatement without certification; '
    || 'surveillance/stalking; impersonation; requests to evade taxes or laws; '
    || 'ambiguous “cash only, no receipt” schemes; work requiring RBQ licence without stating credentials '
    || '(major renovations, structural, pools, etc.). Quebec: respect RBQ, CNESST, and municipal permits.';

  if p_reason = 'redo' then
    v_title := 'Service request removed — please submit again';
    v_body := 'Your request was removed so you can redo it with clearer details, photos, and category. No strike was applied.';
    v_strike_after := null;
  else
    update public.profiles
    set job_request_strikes = coalesce(job_request_strikes, 0) + 1
    where user_id = v_req.client_id;

    select coalesce(job_request_strikes, 0) into v_strike_after
    from public.profiles where user_id = v_req.client_id;

    if v_strike_after >= 3 then
      update public.profiles set job_requests_blocked_at = now() where user_id = v_req.client_id;
    end if;

    v_title := 'Service request removed';
    if p_reason = 'inappropriate' then
      v_body := format(
        'Your request was removed as inappropriate (strike %s of 3). Two more inappropriate or suspicious requests will result in your account being banned from posting requests.',
        v_strike_after
      );
    else
      v_body := format(
        'Your request was removed due to suspicious activity (strike %s of 3). Two more inappropriate or suspicious requests will result in your account being banned from posting requests.',
        v_strike_after
      );
    end if;
    if v_strike_after >= 3 then
      v_body := v_body || ' Your account is now blocked from creating new service requests.';
    end if;
  end if;

  insert into public.job_request_moderation_notices (
    user_id, job_request_id, reason, strike_count, title, body, rules_reminder
  ) values (
    v_req.client_id, p_request_id, p_reason, v_strike_after, v_title, v_body, v_rules
  );

  return jsonb_build_object(
    'ok', true,
    'strike_count', v_strike_after,
    'blocked', v_strike_after is not null and v_strike_after >= 3
  );
end;
$$;
