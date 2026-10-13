-- Per-client opt-out and interval overrides for professional rebooking reminders.
create table if not exists public.pro_client_reminder_preferences (
  pro_profile_id uuid not null references public.pro_profiles(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  weeks integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pro_profile_id, client_id),
  constraint pro_client_reminder_preferences_weeks_chk check (weeks is null or weeks between 1 and 104)
);

create index if not exists pro_client_reminder_preferences_client_idx
  on public.pro_client_reminder_preferences (client_id, pro_profile_id);

alter table public.pro_client_reminder_preferences enable row level security;
revoke all on public.pro_client_reminder_preferences from public, anon;
grant select, insert, update, delete on public.pro_client_reminder_preferences to authenticated;

drop policy if exists "Pros read reminder preferences for their clients" on public.pro_client_reminder_preferences;
create policy "Pros read reminder preferences for their clients"
  on public.pro_client_reminder_preferences for select to authenticated
  using (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bookings b
      where b.pro_profile_id = pro_client_reminder_preferences.pro_profile_id
        and b.client_id = pro_client_reminder_preferences.client_id
    )
    and public.pro_has_growth_tools(pro_profile_id)
  );

drop policy if exists "Pros set reminder preferences for their clients" on public.pro_client_reminder_preferences;
create policy "Pros set reminder preferences for their clients"
  on public.pro_client_reminder_preferences for insert to authenticated
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bookings b
      where b.pro_profile_id = pro_client_reminder_preferences.pro_profile_id
        and b.client_id = pro_client_reminder_preferences.client_id
    )
    and public.pro_has_growth_tools(pro_profile_id)
  );

drop policy if exists "Pros update reminder preferences for their clients" on public.pro_client_reminder_preferences;
create policy "Pros update reminder preferences for their clients"
  on public.pro_client_reminder_preferences for update to authenticated
  using (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bookings b
      where b.pro_profile_id = pro_client_reminder_preferences.pro_profile_id
        and b.client_id = pro_client_reminder_preferences.client_id
    )
    and public.pro_has_growth_tools(pro_profile_id)
  )
  with check (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bookings b
      where b.pro_profile_id = pro_client_reminder_preferences.pro_profile_id
        and b.client_id = pro_client_reminder_preferences.client_id
    )
    and public.pro_has_growth_tools(pro_profile_id)
  );

drop policy if exists "Pros remove reminder preferences for their clients" on public.pro_client_reminder_preferences;
create policy "Pros remove reminder preferences for their clients"
  on public.pro_client_reminder_preferences for delete to authenticated
  using (
    exists (
      select 1 from public.pro_profiles pp
      where pp.id = pro_profile_id and pp.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.bookings b
      where b.pro_profile_id = pro_client_reminder_preferences.pro_profile_id
        and b.client_id = pro_client_reminder_preferences.client_id
    )
    and public.pro_has_growth_tools(pro_profile_id)
  );

drop trigger if exists trg_pro_client_reminder_preferences_updated_at on public.pro_client_reminder_preferences;
create trigger trg_pro_client_reminder_preferences_updated_at
  before update on public.pro_client_reminder_preferences
  for each row execute function public.update_updated_at_column();

-- Return the current per-client settings with the same owner/tier checks as client history.
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
      'reminder_enabled', coalesce(rp.enabled, true),
      'reminder_weeks', rp.weeks,
      'bookings', pc.bookings
    ) order by pc.last_activity desc), '[]'::jsonb)
  into v_result
  from per_client pc
  left join public.profiles pr on pr.user_id = pc.client_id
  left join public.pro_client_notes n on n.pro_profile_id = p_pro_profile_id and n.client_id = pc.client_id
  left join public.pro_client_reminder_preferences rp on rp.pro_profile_id = p_pro_profile_id and rp.client_id = pc.client_id;

  return v_result;
end;
$$;
revoke execute on function public.pro_client_history(uuid) from public, anon;
grant execute on function public.pro_client_history(uuid) to authenticated;

-- Honor per-client opt-outs and intervals while keeping the pro-wide switch as the master control.
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
    select ld.*, pp.rebook_reminder_weeks, rp.enabled as client_reminders_enabled, rp.weeks as client_reminder_weeks,
      case
        when coalesce(rp.weeks, 0) > 0 then ld.last_visit + (rp.weeks * 7)
        when ld.client_renews_annually and coalesce(ld.renewal_interval_months_snapshot, 0) > 0
          then (coalesce(ld.renewal_anchor_date, ld.last_visit) + make_interval(months => ld.renewal_interval_months_snapshot))::date
        else ld.last_visit + (pp.rebook_reminder_weeks * 7)
      end as due_date,
      public.pro_effective_tier(ld.pro_profile_id) as tier
    from last_done ld
    join public.pro_profiles pp on pp.id = ld.pro_profile_id
    left join public.pro_client_reminder_preferences rp
      on rp.pro_profile_id = ld.pro_profile_id and rp.client_id = ld.client_id
    where pp.rebook_reminder_enabled and coalesce(rp.enabled, true)
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
        and coalesce(x.preferred_date, (x.created_at at time zone 'America/Toronto')::date) >= t.d
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
