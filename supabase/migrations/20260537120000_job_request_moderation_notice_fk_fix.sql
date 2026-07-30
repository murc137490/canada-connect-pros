-- Fix admin "Remove & notify": notices.user_id must not require auth.users when
-- job_requests.client_id has no matching auth row (legacy/orphan rows).

alter table public.job_request_moderation_notices
  drop constraint if exists job_request_moderation_notices_user_id_fkey;

create or replace function public.moderate_job_request_admin(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_req public.job_requests%rowtype;
  v_title text;
  v_body text;
  v_rules text;
  v_strike_after int;
  v_notified boolean := false;
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason not in ('inappropriate', 'suspicious', 'redo') then
    raise exception 'INVALID_REASON';
  end if;

  begin
    perform public.purge_job_requests_older_than_seven_days();
  exception
    when undefined_function then null;
  end;

  select * into v_req from public.job_requests where id = p_request_id for update;
  if not found then
    raise exception 'NOT_FOUND';
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
    if exists (select 1 from public.profiles p where p.user_id = v_req.client_id) then
      update public.profiles
      set job_request_strikes = coalesce(job_request_strikes, 0) + 1
      where user_id = v_req.client_id;

      select coalesce(job_request_strikes, 0) into v_strike_after
      from public.profiles where user_id = v_req.client_id;

      if v_strike_after >= 3 then
        update public.profiles set job_requests_blocked_at = now() where user_id = v_req.client_id;
      end if;
    else
      v_strike_after := null;
    end if;

    v_title := 'Service request removed';
    if p_reason = 'inappropriate' then
      v_body := format(
        'Your request was removed as inappropriate (strike %s of 3). Two more inappropriate or suspicious requests will result in your account being banned from posting requests.',
        coalesce(v_strike_after::text, '?')
      );
    else
      v_body := format(
        'Your request was removed due to suspicious activity (strike %s of 3). Two more inappropriate or suspicious requests will result in your account being banned from posting requests.',
        coalesce(v_strike_after::text, '?')
      );
    end if;
    if v_strike_after is not null and v_strike_after >= 3 then
      v_body := v_body || ' Your account is now blocked from creating new service requests.';
    end if;
  end if;

  insert into public.job_request_moderation_notices (
    user_id, job_request_id, reason, strike_count, title, body, rules_reminder
  ) values (
    v_req.client_id, p_request_id, p_reason, v_strike_after, v_title, v_body, v_rules
  );
  v_notified := true;

  return jsonb_build_object(
    'ok', true,
    'strike_count', v_strike_after,
    'blocked', v_strike_after is not null and v_strike_after >= 3,
    'notified', v_notified
  );
end;
$$;

revoke all on function public.moderate_job_request_admin(uuid, text) from public;
grant execute on function public.moderate_job_request_admin(uuid, text) to authenticated;
