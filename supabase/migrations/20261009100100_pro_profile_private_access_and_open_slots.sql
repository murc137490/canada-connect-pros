-- Security review 2026-10-08, HIGH 1 (part A: additive + backwards compatible; safe to apply
-- before the frontend ships). Part B (column-level grant lockdown) is a separate migration:
-- 20261009100500_pro_profiles_column_lockdown.sql.
--
-- Public = only what the public pro page shows. Private fields (phone, business_address,
-- exact coords, ID documents, approval baseline, SMS templates, tax numbers, unavailable dates /
-- date overrides, other clients' bookings, …) are reached only through the RPCs below.

-- 1) City-level location + ~1 km rounded coordinates as generated (read-only) columns -----------
create or replace function public.city_level_location(p_location text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
  p text;
  cleaned text[] := '{}';
  i int;
  prov text;
  city text;
begin
  if p_location is null or btrim(p_location) = '' then
    return null;
  end if;
  parts := string_to_array(p_location, ',');
  foreach p in array parts loop
    p := btrim(p);
    if p <> '' and lower(p) not in ('canada', 'ca') then
      cleaned := cleaned || p;
    end if;
  end loop;
  if coalesce(array_length(cleaned, 1), 0) = 0 then
    return null;
  end if;
  -- Find the province part ("QC", "QC J2S 1Z5", "Québec", "ON …").
  for i in 1 .. array_length(cleaned, 1) loop
    if cleaned[i] ~* '^(qc|québec|quebec|on|ontario|nb|nouveau-brunswick|new brunswick)(\s|$)' then
      prov := upper(substring(cleaned[i] from '^\S+'));
      if prov in ('QUÉBEC', 'QUEBEC') then prov := 'QC'; end if;
      if prov = 'ONTARIO' then prov := 'ON'; end if;
      if i > 1 then
        city := cleaned[i - 1];
      end if;
      exit;
    end if;
    -- A bare postal code / FSA part ("J2G", "J2S 1Z5"): the city is the part before it.
    if cleaned[i] ~* '^[a-z][0-9][a-z](\s*[0-9][a-z][0-9])?$' then
      if i > 1 then
        city := cleaned[i - 1];
      end if;
      exit;
    end if;
  end loop;
  if city is null then
    city := cleaned[array_length(cleaned, 1)];
  end if;
  -- Never publish something that looks like a street address or intersection.
  if city ~ '[0-9]' or city ~ '/' then
    return prov;
  end if;
  return case when prov is not null then city || ', ' || prov else city end;
end;
$$;

alter table public.pro_profiles
  add column if not exists location_city text
    generated always as (public.city_level_location(location)) stored,
  add column if not exists latitude_approx double precision
    generated always as (round(latitude::numeric, 2)::double precision) stored,
  add column if not exists longitude_approx double precision
    generated always as (round(longitude::numeric, 2)::double precision) stored;

comment on column public.pro_profiles.location_city is
  'Public city-level location derived from location (street addresses stripped). Security review 2026-10-08.';
comment on column public.pro_profiles.latitude_approx is
  'latitude rounded to 2 decimals (~1 km) for public travel estimates; exact latitude is private.';
comment on column public.pro_profiles.longitude_approx is
  'longitude rounded to 2 decimals (~1 km) for public travel estimates; exact longitude is private.';

-- 2) Owner / admin / counterparty access RPCs -----------------------------------------------------
create or replace function public.get_my_pro_profile()
returns setof public.pro_profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.* from public.pro_profiles p
  where auth.uid() is not null and p.user_id = auth.uid();
$$;
revoke all on function public.get_my_pro_profile() from public, anon;
grant execute on function public.get_my_pro_profile() to authenticated;

create or replace function public.admin_get_pro_profiles(p_ids uuid[] default null)
returns setof public.pro_profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.auth_is_platform_moderator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select p.* from public.pro_profiles p
    where p_ids is null or p.id = any (p_ids)
    order by p.created_at desc;
end;
$$;
revoke all on function public.admin_get_pro_profiles(uuid[]) from public, anon;
grant execute on function public.admin_get_pro_profiles(uuid[]) to authenticated;

-- Invoice supplier fields. Signed-in callers only: verified pros (needed to build the invoice at
-- checkout), the caller's own pro profile, pros the caller has booked, or moderators.
create or replace function public.get_pro_billing_details(p_pro_profile_ids uuid[])
returns table (
  id uuid,
  legal_business_name text,
  business_address text,
  location text,
  gst_registration_number text,
  qst_registration_number text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.legal_business_name, p.business_address, p.location,
         p.gst_registration_number, p.qst_registration_number
  from public.pro_profiles p
  where auth.uid() is not null
    and p.id = any (p_pro_profile_ids[1:50])
    and (
      p.is_verified = true
      or p.user_id = auth.uid()
      or public.auth_is_platform_moderator()
      or exists (select 1 from public.bookings b where b.pro_profile_id = p.id and b.client_id = auth.uid())
    );
$$;
revoke all on function public.get_pro_billing_details(uuid[]) from public, anon;
grant execute on function public.get_pro_billing_details(uuid[]) to authenticated;

-- 3) Open booking slots (public) -----------------------------------------------------------------
create or replace function public.hhmm_to_minutes(p text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when m is null then null
    else (m[1])::int * 60 + (m[2])::int
  end
  from (select regexp_match(coalesce(p, ''), '^\s*(\d{1,2}):(\d{2})') as m) s;
$$;

-- Mirrors parseAvailabilityToWeekly() in src/lib/proWeeklyAvailability.ts (JSON + legacy text).
create or replace function public.pro_weekly_window(p_availability text, p_dow integer)
returns int4range
language plpgsql
immutable
set search_path = ''
as $$
declare
  keys text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  k text := keys[p_dow + 1];
  j jsonb;
  d jsonb;
  s int;
  e int;
  t text;
  m text[];
  a int;
  b int;
  marked boolean := false;
  has_m boolean;
  has_a boolean;
  has_e boolean;
begin
  if p_availability is null or btrim(p_availability) = '' or k is null then
    return null;
  end if;
  t := btrim(p_availability);
  if left(t, 1) = '{' then
    begin
      j := t::jsonb;
    exception when others then
      j := null;
    end;
    if j is not null then
      d := j -> k;
      if d is null or jsonb_typeof(d) <> 'object' then
        return null;
      end if;
      if not (
        coalesce((d ->> 'available')::boolean, false) or coalesce((d ->> 'morning')::boolean, false)
        or coalesce((d ->> 'afternoon')::boolean, false) or coalesce((d ->> 'evening')::boolean, false)
      ) then
        return null;
      end if;
      s := public.hhmm_to_minutes(coalesce(d ->> 'start', '09:00'));
      e := public.hhmm_to_minutes(coalesce(d ->> 'end', '17:00'));
      if s is null or e is null or e <= s then
        return null;
      end if;
      return int4range(s, e);
    end if;
  end if;

  t := lower(t);
  m := regexp_match(t, '\m(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*[-–—]\s*(sun|mon|tue|wed|thu|fri|sat)');
  if m is not null then
    a := array_position(keys, m[1]) - 1;
    b := array_position(keys, m[2]) - 1;
    marked := p_dow between least(a, b) and greatest(a, b);
  else
    if (t ~ '\mweekday' or (t ~ '\mmon\M' and t ~ '\mfri\M')) and p_dow between 1 and 5 then
      marked := true;
    end if;
    if t ~ '\mevery\s*day\M|\m7\s*days\M|\mdaily\M' then
      marked := true;
    end if;
    if t ~ ('\m' || k) then
      marked := true;
    end if;
  end if;
  if not marked then
    return null;
  end if;
  has_m := t ~ '\mmorning';
  has_a := t ~ '\mafternoon';
  has_e := t ~ '\mevening';
  if has_m and not has_a and not has_e then return int4range(480, 720); end if;
  if has_a and not has_m and not has_e then return int4range(720, 1020); end if;
  if has_e and not has_m and not has_a then return int4range(1020, 1260); end if;
  if has_m and has_a and has_e then return int4range(480, 1260); end if;
  return int4range(540, 1020);
end;
$$;

-- Returns only OPEN windows per day: weekly hours (or a date override) minus the pro's blocked
-- times minus active bookings (pending/accepted/completed). No client data, notes or reasons.
-- grid_start_min = start of the day's schedule so the UI keeps its hourly start-time grid.
create or replace function public.get_pro_open_slots(p_pro_profile_id uuid, p_from date default null, p_to date default null)
returns table (slot_date date, start_time text, end_time text, grid_start_min integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_pro record;
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_from date;
  v_to date;
  d date;
  v_key text;
  v_win int4range;
  v_free int4multirange;
  v_exc jsonb;
  v_slots jsonb;
  v_slot jsonb;
  sm int;
  em int;
  v_busy int4multirange;
  r int4range;
begin
  select p.id, p.user_id, p.is_verified, p.availability, p.unavailable_dates, p.available_date_overrides
    into v_pro
  from public.pro_profiles p
  where p.id = p_pro_profile_id;
  if v_pro.id is null or (v_pro.is_verified is not true and v_pro.user_id is distinct from auth.uid()) then
    return;
  end if;

  v_from := greatest(coalesce(p_from, v_today), v_today);
  v_to := least(coalesce(p_to, v_from + 60), v_from + 186);
  if v_to < v_from then
    return;
  end if;

  for d in select g::date from generate_series(v_from, v_to, interval '1 day') g loop
    v_key := to_char(d, 'YYYY-MM-DD');
    v_exc := coalesce(v_pro.unavailable_dates, '{}'::jsonb) -> v_key;

    -- Whole-day blocks (same rules as isWholeDayUnavailable()).
    if v_exc is not null and (
      v_exc = 'true'::jsonb
      or (jsonb_typeof(v_exc) = 'object' and (
        (v_exc ->> 'wholeDay') = 'true'
        or (
          (v_exc -> 'wholeDay') is null
          and nullif(btrim(coalesce(v_exc ->> 'note', '')), '') is not null
          and (jsonb_typeof(v_exc -> 'slots') is distinct from 'array' or jsonb_array_length(v_exc -> 'slots') = 0)
        )
      ))
    ) then
      continue;
    end if;

    if jsonb_typeof(v_pro.available_date_overrides) = 'array' and v_pro.available_date_overrides ? v_key then
      v_win := int4range(540, 1020);
    else
      v_win := public.pro_weekly_window(v_pro.availability, extract(dow from d)::int);
    end if;
    if v_win is null or isempty(v_win) then
      continue;
    end if;
    v_free := int4multirange(v_win);

    -- Partial-day blocks.
    v_slots := case
      when v_exc is null then '[]'::jsonb
      when jsonb_typeof(v_exc) = 'array' then v_exc
      when jsonb_typeof(v_exc) = 'object' and jsonb_typeof(v_exc -> 'slots') = 'array' then v_exc -> 'slots'
      else '[]'::jsonb
    end;
    for v_slot in select x from jsonb_array_elements(v_slots) x loop
      sm := public.hhmm_to_minutes(v_slot ->> 'start');
      em := public.hhmm_to_minutes(v_slot ->> 'end');
      if sm is not null and em is not null and em > sm then
        v_free := v_free - int4multirange(int4range(sm, em));
      end if;
    end loop;

    -- Active bookings (any client) take their slot for everyone.
    select range_agg(int4range(bs, bs + dur))
      into v_busy
    from (
      select
        (extract(hour from coalesce(b.preferred_time, (b.created_at at time zone 'America/Toronto')::time)) * 60
          + extract(minute from coalesce(b.preferred_time, (b.created_at at time zone 'America/Toronto')::time)))::int as bs,
        coalesce(nullif(b.service_duration_minutes, 0), 60) as dur
      from public.bookings b
      where b.pro_profile_id = v_pro.id
        and b.status in ('pending', 'accepted', 'completed')
        and coalesce(b.preferred_date, (b.created_at at time zone 'America/Toronto')::date) = d
    ) x;
    if v_busy is not null then
      v_free := v_free - v_busy;
    end if;

    for r in select u from unnest(v_free) u loop
      if not isempty(r) then
        slot_date := d;
        start_time := lpad((lower(r) / 60)::text, 2, '0') || ':' || lpad((lower(r) % 60)::text, 2, '0');
        end_time := lpad((upper(r) / 60)::text, 2, '0') || ':' || lpad((upper(r) % 60)::text, 2, '0');
        grid_start_min := lower(v_win);
        return next;
      end if;
    end loop;
  end loop;
end;
$$;
revoke all on function public.get_pro_open_slots(uuid, date, date) from public;
grant execute on function public.get_pro_open_slots(uuid, date, date) to anon, authenticated;

-- 4) Server-side double-booking guard (trigger name sorts first so a rejected insert does not
--    consume an invoice number from booking_invoice_number_seq) ---------------------------------
create or replace function public.bookings_prevent_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start int;
  v_end int;
begin
  if new.pro_profile_id is null or new.preferred_date is null or new.preferred_time is null
     or new.status not in ('pending', 'accepted', 'completed') then
    return new;
  end if;
  -- Status changes between active states (pending -> accepted -> completed) and edits that do not
  -- move the slot are not re-checked, so legacy rows can still be accepted/completed.
  if tg_op = 'UPDATE'
     and old.status in ('pending', 'accepted', 'completed')
     and old.pro_profile_id = new.pro_profile_id
     and old.preferred_date is not distinct from new.preferred_date
     and old.preferred_time is not distinct from new.preferred_time
     and old.service_duration_minutes is not distinct from new.service_duration_minutes then
    return new;
  end if;

  -- Serialize concurrent bookings for the same pro so two clients can't grab the same slot.
  perform pg_advisory_xact_lock(hashtextextended('booking-slot:' || new.pro_profile_id::text, 0));

  v_start := (extract(hour from new.preferred_time) * 60 + extract(minute from new.preferred_time))::int;
  v_end := v_start + coalesce(nullif(new.service_duration_minutes, 0), 60);

  if exists (
    select 1
    from public.bookings b
    where b.pro_profile_id = new.pro_profile_id
      and b.id <> new.id
      and b.status in ('pending', 'accepted', 'completed')
      and b.preferred_date = new.preferred_date
      and b.preferred_time is not null
      and int4range(v_start, v_end) && int4range(
        (extract(hour from b.preferred_time) * 60 + extract(minute from b.preferred_time))::int,
        (extract(hour from b.preferred_time) * 60 + extract(minute from b.preferred_time))::int
          + coalesce(nullif(b.service_duration_minutes, 0), 60)
      )
  ) then
    raise exception 'SLOT_TAKEN'
      using errcode = 'exclusion_violation',
            detail = 'This time slot was just booked. Please choose another time.',
            hint = 'Ce créneau vient d''être réservé. Veuillez choisir une autre heure.';
  end if;
  return new;
end;
$$;
revoke all on function public.bookings_prevent_overlap() from public, anon, authenticated;

drop trigger if exists trg_bookings_00_prevent_overlap on public.bookings;
create trigger trg_bookings_00_prevent_overlap
  before insert or update of status, preferred_date, preferred_time, service_duration_minutes, pro_profile_id
  on public.bookings
  for each row execute function public.bookings_prevent_overlap();

-- 5) Recurring-series generator: skip a taken slot instead of aborting the cron run --------------
CREATE OR REPLACE FUNCTION public.booking_series_generate_due(p_dry_run boolean DEFAULT true, p_horizon_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Double-booking guard (trg_bookings_00_prevent_overlap) raises 23P01 when the slot is taken:
    -- skip this occurrence instead of aborting the whole cron run.
    begin
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
    exception when exclusion_violation then
      update public.booking_series
        set next_date = public.booking_series_step(v_date, v_s.frequency), last_skip_reason = 'slot_taken'
        where id = v_s.id;
      v_out := v_out || jsonb_build_object('series_id', v_s.id, 'skipped', 'slot_taken', 'date', v_date);
      continue;
    end;

    update public.booking_series
      set next_date = public.booking_series_step(v_date, v_s.frequency),
          last_booking_id = v_new_id, last_generated_at = now(), last_skip_reason = null
      where id = v_s.id;

    v_out := v_out || jsonb_build_object('series_id', v_s.id, 'booking_id', v_new_id, 'date', v_date, 'status', v_status);
  end loop;
  return v_out;
end;
$function$;

