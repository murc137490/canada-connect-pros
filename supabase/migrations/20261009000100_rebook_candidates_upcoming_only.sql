-- Follow-up to growth_tools: only an UPCOMING pending/accepted booking suppresses a rebooking reminder
-- (a past booking left in 'accepted' must not block reminders forever).
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
