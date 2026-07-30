-- Job request moderation (admin), client strikes, and per-user notices.

alter table public.profiles
  add column if not exists job_request_strikes integer not null default 0,
  add column if not exists job_requests_blocked_at timestamptz;

comment on column public.profiles.job_request_strikes is
  'Strikes from admin removals for inappropriate or suspicious job requests (3 = blocked).';
comment on column public.profiles.job_requests_blocked_at is
  'When set, client cannot create new job requests.';

alter table public.job_requests
  add column if not exists moderation_reason text,
  add column if not exists moderation_removed_at timestamptz,
  add column if not exists moderation_removed_by uuid references auth.users (id) on delete set null;

comment on column public.job_requests.moderation_reason is
  'inappropriate | suspicious | redo — set when admin removes an open request.';

create table if not exists public.job_request_moderation_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_request_id uuid references public.job_requests (id) on delete set null,
  reason text not null check (reason in ('inappropriate', 'suspicious', 'redo')),
  strike_count integer,
  title text not null,
  body text not null,
  rules_reminder text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_request_moderation_notices_user_idx
  on public.job_request_moderation_notices (user_id, created_at desc);

alter table public.job_request_moderation_notices enable row level security;

create policy job_request_moderation_notices_select_own
  on public.job_request_moderation_notices for select to authenticated
  using (user_id = auth.uid());

create policy job_request_moderation_notices_update_own_read
  on public.job_request_moderation_notices for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, update on public.job_request_moderation_notices to authenticated;

-- Admins: read all job requests (any status) and moderate.
drop policy if exists "Moderators read all job_requests" on public.job_requests;
create policy "Moderators read all job_requests"
  on public.job_requests for select to authenticated
  using (
    public.auth_is_platform_moderator()
    or auth.uid() = client_id
    or (
      status = 'open'
      and exists (select 1 from public.pro_profiles p where p.user_id = auth.uid())
    )
  );

drop policy if exists "Moderators update job_requests moderation" on public.job_requests;
create policy "Moderators update job_requests moderation"
  on public.job_requests for update to authenticated
  using (public.auth_is_platform_moderator())
  with check (public.auth_is_platform_moderator());

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

revoke all on function public.moderate_job_request_admin(uuid, text) from public;
grant execute on function public.moderate_job_request_admin(uuid, text) to authenticated;

drop policy if exists "Moderators read profiles for support" on public.profiles;
create policy "Moderators read profiles for support"
  on public.profiles for select to authenticated
  using (public.auth_is_platform_moderator() or user_id = auth.uid());

-- Moderators can insert notices (via RPC only) and read all for support.
drop policy if exists "Moderators read job_request_moderation_notices" on public.job_request_moderation_notices;
create policy "Moderators read job_request_moderation_notices"
  on public.job_request_moderation_notices for select to authenticated
  using (public.auth_is_platform_moderator() or user_id = auth.uid());
