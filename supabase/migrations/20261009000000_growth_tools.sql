-- Growth & Pro tools (Oct 2026): response time, client history (CRM), returning-customer reminders,
-- Book Again support, automatic repeat bookings, server-side request limits, featured palette remap.
-- Additive only: new tables/columns/functions/triggers. No user data is deleted.

-- ---------------------------------------------------------------------------------------------
-- Tier helpers (mirror src/lib/proTierFeatures.ts effectiveProTier: subscription plan wins; hold = none)
-- ---------------------------------------------------------------------------------------------
create or replace function public.pro_effective_tier(p_pro_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select pp.user_id, lower(trim(coalesce(pp.subscription_tier, ''))) as t
    from public.pro_profiles pp where pp.id = p_pro_profile_id
  ),
  s as (
    select lower(trim(coalesce(ps.plan_id, ''))) as t
    from public.pro_subscriptions ps join p on ps.user_id = p.user_id
    limit 1
  )
  select case
    when (select t from s) = 'hold' then null
    when (select t from s) in ('starter', 'growth', 'pro') then (select t from s)
    when (select t from p) in ('starter', 'growth', 'pro') then (select t from p)
    else null
  end;
$$;

create or replace function public.pro_has_growth_tools(p_pro_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.pro_effective_tier(p_pro_profile_id) in ('growth', 'pro'), false);
$$;

/** Monthly client request limit: starter 20, growth 50, pro unlimited (null), hold/none 0. */
create or replace function public.pro_client_request_limit(p_tier text)
returns integer
language sql
immutable
as $$
  select case p_tier when 'starter' then 20 when 'growth' then 50 when 'pro' then null else 0 end;
$$;

create or replace function public.is_privileged_db_caller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or (auth.uid() is null and current_user in ('postgres', 'supabase_admin'))
    or public.auth_is_platform_moderator();
$$;

grant execute on function public.pro_effective_tier(uuid) to anon, authenticated, service_role;
grant execute on function public.pro_has_growth_tools(uuid) to anon, authenticated, service_role;
grant execute on function public.pro_client_request_limit(text) to anon, authenticated, service_role;
revoke execute on function public.is_privileged_db_caller() from public, anon;
grant execute on function public.is_privileged_db_caller() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- B. Server-side client request limits (same rule as the dashboard: Nth request of the month,
--    oldest first, America/Toronto months). Only blocks NEW actions; existing rows are untouched.
-- ---------------------------------------------------------------------------------------------
create or replace function public.booking_request_rank_in_month(p_booking_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.bookings b
  join public.bookings me on me.id = p_booking_id
  where b.pro_profile_id = me.pro_profile_id
    and date_trunc('month', b.created_at at time zone 'America/Toronto')
        = date_trunc('month', me.created_at at time zone 'America/Toronto')
    and (b.created_at < me.created_at or (b.created_at = me.created_at and b.id <= me.id));
$$;
revoke execute on function public.booking_request_rank_in_month(uuid) from public, anon;
grant execute on function public.booking_request_rank_in_month(uuid) to authenticated, service_role;

create or replace function public.bookings_enforce_client_request_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
begin
  if not (old.status = 'pending' and new.status = 'accepted') then
    return new;
  end if;
  if public.is_privileged_db_caller() then
    return new;
  end if;
  v_limit := public.pro_client_request_limit(public.pro_effective_tier(new.pro_profile_id));
  if v_limit is null then
    return new;
  end if;
  if public.booking_request_rank_in_month(new.id) > v_limit then
    raise exception 'client_request_limit_reached'
      using errcode = 'P0001',
            hint = 'This request is over your plan''s monthly client request limit. Upgrade your plan to accept it.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_enforce_client_request_limit on public.bookings;
create trigger trg_bookings_enforce_client_request_limit
  before update of status on public.bookings
  for each row execute function public.bookings_enforce_client_request_limit();

create or replace function public.job_quotes_enforce_client_request_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if public.is_privileged_db_caller() then
    return new;
  end if;
  v_limit := public.pro_client_request_limit(public.pro_effective_tier(new.pro_profile_id));
  if v_limit is null then
    return new;
  end if;
  select count(distinct q.job_request_id) into v_used
  from public.job_quotes q
  where q.pro_profile_id = new.pro_profile_id
    and q.job_request_id <> new.job_request_id
    and date_trunc('month', q.created_at at time zone 'America/Toronto')
        = date_trunc('month', now() at time zone 'America/Toronto');
  if v_used >= v_limit then
    raise exception 'client_request_limit_reached'
      using errcode = 'P0001',
            hint = 'You reached your plan''s monthly client request limit. Upgrade your plan to respond to more requests.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_job_quotes_enforce_client_request_limit on public.job_quotes;
create trigger trg_job_quotes_enforce_client_request_limit
  before insert on public.job_quotes
  for each row execute function public.job_quotes_enforce_client_request_limit();

-- ---------------------------------------------------------------------------------------------
-- A1. Response time on profile (Growth/Pro only; median of the 20 most recent responses in
--     the last 180 days; needs at least 3 responses, otherwise nothing is shown)
-- ---------------------------------------------------------------------------------------------
-- (defined at the end of this file, after bookings.series_id exists)

-- ---------------------------------------------------------------------------------------------
-- A2. Client history (CRM): private notes + per-client history RPC (pro sees only own clients;
--     no client email/phone is returned)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.pro_client_notes (
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pro_profile_id, client_id)
);
alter table public.pro_client_notes enable row level security;

create or replace function public.auth_owns_pro_with_client(p_pro_profile_id uuid, p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pro_profiles pp
    where pp.id = p_pro_profile_id and pp.user_id = auth.uid()
  ) and exists (
    select 1 from public.bookings b
    where b.pro_profile_id = p_pro_profile_id and b.client_id = p_client_id
  );
$$;
revoke execute on function public.auth_owns_pro_with_client(uuid, uuid) from public, anon;
grant execute on function public.auth_owns_pro_with_client(uuid, uuid) to authenticated, service_role;

drop policy if exists "Pro reads own client notes" on public.pro_client_notes;
create policy "Pro reads own client notes" on public.pro_client_notes
  for select to authenticated
  using (public.auth_owns_pro_with_client(pro_profile_id, client_id));
drop policy if exists "Pro writes own client notes" on public.pro_client_notes;
create policy "Pro writes own client notes" on public.pro_client_notes
  for insert to authenticated
  with check (public.auth_owns_pro_with_client(pro_profile_id, client_id) and public.pro_has_growth_tools(pro_profile_id));
drop policy if exists "Pro updates own client notes" on public.pro_client_notes;
create policy "Pro updates own client notes" on public.pro_client_notes
  for update to authenticated
  using (public.auth_owns_pro_with_client(pro_profile_id, client_id))
  with check (public.auth_owns_pro_with_client(pro_profile_id, client_id) and public.pro_has_growth_tools(pro_profile_id));
drop policy if exists "Pro deletes own client notes" on public.pro_client_notes;
create policy "Pro deletes own client notes" on public.pro_client_notes
  for delete to authenticated
  using (public.auth_owns_pro_with_client(pro_profile_id, client_id));

drop trigger if exists trg_pro_client_notes_updated_at on public.pro_client_notes;
create trigger trg_pro_client_notes_updated_at
  before update on public.pro_client_notes
  for each row execute function public.update_updated_at_column();

create or replace function public.pro_client_history(p_pro_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_result jsonb;
begin
  if not exists (select 1 from public.pro_profiles pp where pp.id = p_pro_profile_id and pp.user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.pro_has_growth_tools(p_pro_profile_id) then
    raise exception 'growth_required' using errcode = 'P0001';
  end if;

  with bk as (
    select b.*,
      coalesce(b.preferred_date, (b.created_at at time zone 'America/Toronto')::date) as visit_date,
      (select p.amount_cents from public.payments p
        where p.booking_id = b.id and lower(coalesce(p.status, '')) in ('completed', 'captured', 'paid')
        order by p.created_at desc limit 1) as paid_cents
    from public.bookings b
    where b.pro_profile_id = p_pro_profile_id and b.client_id is not null
  ),
  per_client as (
    select
      bk.client_id,
      count(*)::int as total_bookings,
      count(*) filter (where bk.status = 'completed')::int as completed_count,
      count(*) filter (where bk.status in ('cancelled', 'declined'))::int as cancelled_count,
      coalesce(sum(bk.paid_cents), 0)::bigint as total_paid_cents,
      max(bk.visit_date) filter (where bk.status = 'completed') as last_visit,
      min(bk.visit_date) filter (where bk.status in ('pending', 'accepted') and bk.visit_date >= v_today) as next_visit,
      max(bk.created_at) as last_activity,
      jsonb_agg(jsonb_build_object(
        'id', bk.id,
        'status', bk.status,
        'date', bk.visit_date,
        'time', bk.preferred_time,
        'service_category_slug', bk.service_category_slug,
        'service_slug', bk.service_slug,
        'duration_minutes', bk.service_duration_minutes,
        'paid_cents', bk.paid_cents,
        'code', bk.public_booking_code,
        'series_id', bk.series_id,
        'renewal_interval_months', bk.renewal_interval_months_snapshot
      ) order by bk.visit_date desc, bk.created_at desc) as bookings
    from bk
    group by bk.client_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'client_id', pc.client_id,
      'client_name', nullif(trim(pr.full_name), ''),
      'total_bookings', pc.total_bookings,
      'completed_count', pc.completed_count,
      'cancelled_count', pc.cancelled_count,
      'total_paid_cents', pc.total_paid_cents,
      'last_visit', pc.last_visit,
      'next_visit', pc.next_visit,
      'last_activity', pc.last_activity,
      'note', n.note,
      'note_updated_at', n.updated_at,
      'bookings', pc.bookings
    ) order by pc.last_activity desc), '[]'::jsonb)
  into v_result
  from per_client pc
  left join public.profiles pr on pr.user_id = pc.client_id
  left join public.pro_client_notes n on n.pro_profile_id = p_pro_profile_id and n.client_id = pc.client_id;

  return v_result;
end;
$$;
revoke execute on function public.pro_client_history(uuid) from public, anon;
grant execute on function public.pro_client_history(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A3. Returning-customer reminders
-- ---------------------------------------------------------------------------------------------
alter table public.pro_profiles
  add column if not exists rebook_reminder_enabled boolean not null default false,
  add column if not exists rebook_reminder_weeks integer not null default 8,
  add column if not exists recurring_auto_approve boolean not null default false;

do $$ begin
  alter table public.pro_profiles add constraint pro_profiles_rebook_reminder_weeks_chk
    check (rebook_reminder_weeks between 1 and 104);
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists rebook_reminders_opt_out boolean not null default false;

create table if not exists public.rebook_nudges (
  id uuid primary key default gen_random_uuid(),
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  anchor_booking_id uuid not null references public.bookings(id) on delete cascade,
  due_date date,
  channel text not null check (channel in ('sms', 'email')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1,
  error text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pro_profile_id, client_id, anchor_booking_id)
);
alter table public.rebook_nudges enable row level security;
drop policy if exists "Pro reads own rebook nudges" on public.rebook_nudges;
create policy "Pro reads own rebook nudges" on public.rebook_nudges
  for select to authenticated
  using (exists (select 1 from public.pro_profiles pp where pp.id = rebook_nudges.pro_profile_id and pp.user_id = auth.uid()));
drop policy if exists "Client reads own rebook nudges" on public.rebook_nudges;
create policy "Client reads own rebook nudges" on public.rebook_nudges
  for select to authenticated
  using (client_id = auth.uid());

/** One-click unsubscribe from rebooking reminders (token from the email link). */
create or replace function public.rebook_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from public.rebook_nudges where unsubscribe_token = p_token;
  if v_client is null then
    return false;
  end if;
  update public.profiles set rebook_reminders_opt_out = true where user_id = v_client;
  return true;
end;
$$;
grant execute on function public.rebook_unsubscribe(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- A5. Automatic repeat bookings
-- ---------------------------------------------------------------------------------------------
create table if not exists public.booking_series (
  id uuid primary key default gen_random_uuid(),
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  template_booking_id uuid references public.bookings(id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  preferred_time time,
  service_category_slug text,
  service_slug text,
  service_duration_minutes integer,
  service_location_choice text,
  next_date date not null,
  status text not null default 'active' check (status in ('proposed', 'active', 'paused', 'cancelled')),
  proposed_by text not null check (proposed_by in ('client', 'pro')),
  created_by uuid not null,
  status_changed_by uuid,
  status_changed_at timestamptz,
  last_booking_id uuid references public.bookings(id) on delete set null,
  last_generated_at timestamptz,
  last_skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists booking_series_one_open_per_template
  on public.booking_series (template_booking_id)
  where status in ('proposed', 'active', 'paused') and template_booking_id is not null;
create index if not exists booking_series_due_idx on public.booking_series (status, next_date);

alter table public.booking_series enable row level security;
drop policy if exists "Parties read booking series" on public.booking_series;
create policy "Parties read booking series" on public.booking_series
  for select to authenticated
  using (
    client_id = auth.uid()
    or exists (select 1 from public.pro_profiles pp where pp.id = booking_series.pro_profile_id and pp.user_id = auth.uid())
    or public.auth_uid_is_platform_admin()
  );

drop trigger if exists trg_booking_series_updated_at on public.booking_series;
create trigger trg_booking_series_updated_at
  before update on public.booking_series
  for each row execute function public.update_updated_at_column();

alter table public.bookings
  add column if not exists series_id uuid references public.booking_series(id) on delete set null;
create index if not exists bookings_series_id_idx on public.bookings (series_id) where series_id is not null;

create or replace function public.booking_series_step(p_date date, p_frequency text)
returns date
language sql
immutable
as $$
  select case p_frequency
    when 'weekly' then p_date + 7
    when 'biweekly' then p_date + 14
    else (p_date + interval '1 month')::date
  end;
$$;

/** Client or pro sets up a repeat booking from an accepted/completed booking. */
create or replace function public.booking_series_create(p_template_booking_id uuid, p_frequency text, p_first_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b public.bookings%rowtype;
  v_pro_user uuid;
  v_role text;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_id uuid;
begin
  select * into v_b from public.bookings where id = p_template_booking_id;
  if v_b.id is null then raise exception 'booking_not_found' using errcode = 'P0001'; end if;
  select user_id into v_pro_user from public.pro_profiles where id = v_b.pro_profile_id;
  if auth.uid() = v_b.client_id then v_role := 'client';
  elsif auth.uid() = v_pro_user then v_role := 'pro';
  else raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_b.status not in ('accepted', 'completed') then
    raise exception 'booking_not_confirmed' using errcode = 'P0001';
  end if;
  if not public.pro_has_growth_tools(v_b.pro_profile_id) then
    raise exception 'growth_required' using errcode = 'P0001';
  end if;
  if p_frequency not in ('weekly', 'biweekly', 'monthly') then
    raise exception 'bad_frequency' using errcode = 'P0001';
  end if;
  if p_first_date is null or p_first_date <= v_today or p_first_date > v_today + 120 then
    raise exception 'bad_first_date' using errcode = 'P0001';
  end if;
  insert into public.booking_series (
    pro_profile_id, client_id, template_booking_id, frequency, preferred_time,
    service_category_slug, service_slug, service_duration_minutes, service_location_choice,
    next_date, status, proposed_by, created_by, status_changed_by, status_changed_at
  ) values (
    v_b.pro_profile_id, v_b.client_id, v_b.id, p_frequency, v_b.preferred_time,
    v_b.service_category_slug, v_b.service_slug, v_b.service_duration_minutes, v_b.service_location_choice,
    p_first_date,
    case when v_role = 'client' then 'active' else 'proposed' end,
    v_role, auth.uid(), auth.uid(), now()
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.booking_series_create(uuid, text, date) from public, anon;
grant execute on function public.booking_series_create(uuid, text, date) to authenticated;

/**
 * pause | resume | cancel (either party), accept | decline (client, on a pro's proposal).
 */
create or replace function public.booking_series_update(p_series_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.booking_series%rowtype;
  v_pro_user uuid;
  v_role text;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_next date;
begin
  select * into v_s from public.booking_series where id = p_series_id for update;
  if v_s.id is null then raise exception 'not_found' using errcode = 'P0001'; end if;
  select user_id into v_pro_user from public.pro_profiles where id = v_s.pro_profile_id;
  if auth.uid() = v_s.client_id then v_role := 'client';
  elsif auth.uid() = v_pro_user then v_role := 'pro';
  else raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_s.status = 'cancelled' then raise exception 'already_cancelled' using errcode = 'P0001'; end if;

  if p_action = 'cancel' or (p_action = 'decline' and v_s.status = 'proposed') then
    update public.booking_series set status = 'cancelled', status_changed_by = auth.uid(), status_changed_at = now() where id = v_s.id;
    return 'cancelled';
  elsif p_action = 'pause' and v_s.status = 'active' then
    update public.booking_series set status = 'paused', status_changed_by = auth.uid(), status_changed_at = now() where id = v_s.id;
    return 'paused';
  elsif (p_action = 'resume' and v_s.status = 'paused') or (p_action = 'accept' and v_s.status = 'proposed' and v_role = 'client') then
    if not public.pro_has_growth_tools(v_s.pro_profile_id) then
      raise exception 'growth_required' using errcode = 'P0001';
    end if;
    v_next := v_s.next_date;
    while v_next <= v_today loop
      v_next := public.booking_series_step(v_next, v_s.frequency);
    end loop;
    update public.booking_series
      set status = 'active', next_date = v_next, status_changed_by = auth.uid(), status_changed_at = now()
      where id = v_s.id;
    return 'active';
  end if;
  raise exception 'bad_action' using errcode = 'P0001';
end;
$$;
revoke execute on function public.booking_series_update(uuid, text) from public, anon;
grant execute on function public.booking_series_update(uuid, text) to authenticated;

/**
 * Creates the next booking request for every active series whose next date is within p_horizon_days
 * (service_role only; called by the booking-series-run function). Bookings are created exactly like a
 * normal request: status pending (or accepted when the pro opted into auto-approve and the request is
 * within the plan's monthly limit). No card is charged: the client pays from the dashboard like any
 * accepted booking without a payment. p_dry_run = true returns the plan without writing anything.
 */
create or replace function public.booking_series_generate_due(p_dry_run boolean default true, p_horizon_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_s record;
  v_tpl public.bookings%rowtype;
  v_date date;
  v_status text;
  v_limit integer;
  v_month_count integer;
  v_new_id uuid;
  v_out jsonb := '[]'::jsonb;
  v_snapshot jsonb;
begin
  for v_s in
    select s.*, pp.recurring_auto_approve, public.pro_effective_tier(s.pro_profile_id) as tier
    from public.booking_series s
    join public.pro_profiles pp on pp.id = s.pro_profile_id
    where s.status = 'active' and s.next_date <= v_today + greatest(1, least(p_horizon_days, 30))
    order by s.next_date
    for update of s skip locked
  loop
    v_date := v_s.next_date;
    -- Never create past-dated bookings (series was idle): jump to the next future occurrence.
    while v_date <= v_today loop
      v_date := public.booking_series_step(v_date, v_s.frequency);
    end loop;

    if v_s.tier is null or v_s.tier not in ('growth', 'pro') then
      v_out := v_out || jsonb_build_object('series_id', v_s.id, 'skipped', 'pro_not_on_growth_or_pro');
      if not p_dry_run then
        update public.booking_series set last_skip_reason = 'tier', next_date = v_date where id = v_s.id;
      end if;
      continue;
    end if;

    if v_date > v_today + greatest(1, least(p_horizon_days, 30)) then
      if not p_dry_run and v_date <> v_s.next_date then
        update public.booking_series set next_date = v_date where id = v_s.id;
      end if;
      continue;
    end if;

    if exists (select 1 from public.bookings x where x.series_id = v_s.id and x.preferred_date = v_date) then
      if not p_dry_run then
        update public.booking_series set next_date = public.booking_series_step(v_date, v_s.frequency) where id = v_s.id;
      end if;
      continue;
    end if;

    v_status := 'pending';
    if v_s.recurring_auto_approve then
      v_limit := public.pro_client_request_limit(v_s.tier);
      select count(*) into v_month_count from public.bookings b
      where b.pro_profile_id = v_s.pro_profile_id
        and date_trunc('month', b.created_at at time zone 'America/Toronto') = date_trunc('month', now() at time zone 'America/Toronto');
      if v_limit is null or v_month_count < v_limit then
        v_status := 'accepted';
      end if;
    end if;

    select * into v_tpl from public.bookings where id = v_s.template_booking_id;
    v_snapshot := v_tpl.invoice_snapshot;
    if v_snapshot is not null then
      v_snapshot := v_snapshot
        || jsonb_build_object(
          'preferred_date', v_date,
          'preferred_time', v_s.preferred_time,
          'appointment_summary', to_char(v_date, 'YYYY-MM-DD') || coalesce(' · ' || to_char(v_s.preferred_time, 'HH24:MI'), ''),
          'square_payment_id', null,
          'idempotency_key', null,
          'invoice_number', null,
          'paid_at', null,
          'payment_method_label', 'Paiement à venir / Payment pending'
        );
    end if;

    if p_dry_run then
      v_out := v_out || jsonb_build_object('series_id', v_s.id, 'would_create', true, 'date', v_date, 'status', v_status);
      continue;
    end if;

    insert into public.bookings (
      pro_profile_id, client_id, status, preferred_date, preferred_time, service_duration_minutes,
      service_category_slug, service_slug, service_location_choice, distance_km_snapshot, drive_minutes_snapshot,
      cancel_policy_snapshot, cancel_fee_percent_snapshot, cancel_fee_type_snapshot, cancel_fee_cents_snapshot,
      cancel_policy_acknowledged_at, booking_terms_version, terms_accepted_at, terms_acceptance_method, terms_hash,
      invoice_snapshot, client_unread, pro_unread, responded_at, series_id
    ) values (
      v_s.pro_profile_id, v_s.client_id, v_status, v_date, v_s.preferred_time, v_s.service_duration_minutes,
      v_s.service_category_slug, v_s.service_slug, v_s.service_location_choice, v_tpl.distance_km_snapshot, v_tpl.drive_minutes_snapshot,
      v_tpl.cancel_policy_snapshot, v_tpl.cancel_fee_percent_snapshot, v_tpl.cancel_fee_type_snapshot, v_tpl.cancel_fee_cents_snapshot,
      v_tpl.cancel_policy_acknowledged_at, v_tpl.booking_terms_version, v_tpl.terms_accepted_at, v_tpl.terms_acceptance_method, v_tpl.terms_hash,
      v_snapshot, true, true, case when v_status = 'accepted' then now() end, v_s.id
    )
    returning id into v_new_id;

    update public.booking_series
      set next_date = public.booking_series_step(v_date, v_s.frequency),
          last_booking_id = v_new_id, last_generated_at = now(), last_skip_reason = null
      where id = v_s.id;

    v_out := v_out || jsonb_build_object('series_id', v_s.id, 'booking_id', v_new_id, 'date', v_date, 'status', v_status);
  end loop;
  return v_out;
end;
$$;

/**
 * Who is due for a "book again" nudge (service_role only; used by the rebook-reminders function).
 * Cycle = the client's latest completed booking with that pro. One nudge per cycle.
 * Due date = renewal date if the client opted into the service's renewal interval, else last visit + pro's weeks.
 * Only nudges within 60 days after the due date, and never if the client already has an upcoming
 * booking or an active repeat booking with that pro, or opted out.
 */
create or replace function public.rebook_reminder_candidates(p_limit integer default 200)
returns table (
  pro_profile_id uuid,
  client_id uuid,
  anchor_booking_id uuid,
  last_visit date,
  due_date date,
  tier text,
  service_category_slug text,
  service_slug text,
  attempts integer
)
language sql
stable
security definer
set search_path = public
as $$
  with today as (select (now() at time zone 'America/Toronto')::date as d),
  last_done as (
    select distinct on (b.pro_profile_id, b.client_id)
      b.pro_profile_id, b.client_id, b.id as anchor_booking_id,
      coalesce(b.preferred_date, (b.created_at at time zone 'America/Toronto')::date) as last_visit,
      b.client_renews_annually, b.renewal_anchor_date, b.renewal_interval_months_snapshot,
      b.service_category_slug, b.service_slug
    from public.bookings b
    where b.status = 'completed'
    order by b.pro_profile_id, b.client_id,
      coalesce(b.preferred_date, (b.created_at at time zone 'America/Toronto')::date) desc, b.created_at desc
  ),
  due as (
    select ld.*, pp.rebook_reminder_weeks,
      case
        when ld.client_renews_annually and coalesce(ld.renewal_interval_months_snapshot, 0) > 0
          then (coalesce(ld.renewal_anchor_date, ld.last_visit) + make_interval(months => ld.renewal_interval_months_snapshot))::date
        else ld.last_visit + (pp.rebook_reminder_weeks * 7)
      end as due_date,
      public.pro_effective_tier(ld.pro_profile_id) as tier
    from last_done ld
    join public.pro_profiles pp on pp.id = ld.pro_profile_id
    where pp.rebook_reminder_enabled
  )
  select d.pro_profile_id, d.client_id, d.anchor_booking_id, d.last_visit, d.due_date, d.tier,
         d.service_category_slug, d.service_slug, coalesce(n.attempts, 0)
  from due d
  cross join today t
  join public.profiles cp on cp.user_id = d.client_id
  left join public.rebook_nudges n
    on n.pro_profile_id = d.pro_profile_id and n.client_id = d.client_id and n.anchor_booking_id = d.anchor_booking_id
  where d.tier in ('growth', 'pro')
    and d.due_date <= t.d
    and d.due_date >= t.d - 60
    and not coalesce(cp.rebook_reminders_opt_out, false)
    and (n.id is null or (n.status = 'failed' and n.attempts < 3 and n.updated_at < now() - interval '20 hours'))
    and not exists (
      select 1 from public.bookings x
      where x.pro_profile_id = d.pro_profile_id and x.client_id = d.client_id
        and x.status in ('pending', 'accepted')
    )
    and not exists (
      select 1 from public.booking_series s
      where s.pro_profile_id = d.pro_profile_id and s.client_id = d.client_id
        and s.status in ('proposed', 'active')
    )
  order by d.due_date
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$$;

revoke execute on function public.rebook_reminder_candidates(integer) from public, anon, authenticated;
grant execute on function public.rebook_reminder_candidates(integer) to service_role;
revoke execute on function public.booking_series_generate_due(boolean, integer) from public, anon, authenticated;
grant execute on function public.booking_series_generate_due(boolean, integer) to service_role;

-- ---------------------------------------------------------------------------------------------
-- C. Featured palette (Oct 2026): remap saved old-scheme colours to the closest new colour.
--    Unknown values are also resolved at render time (src/data/proPageColorSchemes.ts).
-- ---------------------------------------------------------------------------------------------
with map(old_primary, primary_c, secondary_c, accent_c, background_c) as (
  values
    ('#1e3a5f', '#49658A', '#3C5371', '#E6E9EF', '#F4F6F8'),
    ('#14532d', '#31594D', '#28493F', '#E2E8E6', '#F3F5F4'),
    ('#7f1d1d', '#682F3B', '#552730', '#EAE2E4', '#F6F3F3'),
    ('#1e293b', '#292929', '#222222', '#E1E1E1', '#F2F2F2'),
    ('#92400e', '#B7654A', '#C37E67', '#F5E9E6', '#FBF6F4'),
    ('#4c1d95', '#5A3F61', '#4A3450', '#E8E4E9', '#F5F3F6'),
    ('#0c4a6e', '#49658A', '#3C5371', '#E6E9EF', '#F4F6F8'),
    ('#171717', '#292929', '#222222', '#E1E1E1', '#F2F2F2')
)
update public.pro_profiles pp
set page_primary_color = m.primary_c,
    page_secondary_color = m.secondary_c,
    page_accent_color = m.accent_c,
    page_background_color = m.background_c
from map m
where lower(trim(pp.page_primary_color)) = m.old_primary;

-- A1 (continued). Public response time
create or replace function public.pro_response_time_summary(p_pro_profile_id uuid)
returns table (median_minutes integer, sample_size integer)
language sql
stable
security definer
set search_path = public
as $$
  with samples as (
    select extract(epoch from (b.responded_at - b.created_at)) / 60.0 as m, b.responded_at as at
    from public.bookings b
    where b.pro_profile_id = p_pro_profile_id
      and b.responded_at is not null
      and b.responded_at >= b.created_at
      and b.responded_at > now() - interval '180 days'
      and b.series_id is null -- repeat-booking visits are not real response times
    union all
    select extract(epoch from (q.created_at - jr.created_at)) / 60.0, q.created_at
    from public.job_quotes q
    join public.job_requests jr on jr.id = q.job_request_id
    where q.pro_profile_id = p_pro_profile_id
      and q.created_at >= jr.created_at
      and q.created_at > now() - interval '180 days'
  ),
  recent as (
    select m from samples order by at desc limit 20
  )
  select
    case when count(*) >= 3 then round(percentile_cont(0.5) within group (order by m))::int end,
    count(*)::int
  from recent
  where public.pro_has_growth_tools(p_pro_profile_id);
$$;
grant execute on function public.pro_response_time_summary(uuid) to anon, authenticated, service_role;
