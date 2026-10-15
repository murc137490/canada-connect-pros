-- Central plan refill prices and a hard cap on credits charged per booking.
update public.subscription_plans
set monthly_booking_credits = case id
  when 'starter' then 10 when 'growth' then 17 when 'pro' then 22
  else monthly_booking_credits end
where id in ('starter', 'growth', 'pro');

alter table public.booking_credit_config
  add column if not exists max_credits_per_booking integer not null default 100
  check (max_credits_per_booking > 0);
update public.booking_credit_config set coverage_cents = 10000, max_credits_per_booking = 100 where id = true;

create table if not exists public.booking_credit_refill_prices (
  plan_id text not null references public.subscription_plans(id) on delete cascade,
  credit_amount integer not null check (credit_amount > 0 and credit_amount <= 100),
  price_cents integer not null check (price_cents >= 50),
  updated_at timestamptz not null default now(),
  primary key (plan_id, credit_amount)
);
insert into public.booking_credit_refill_prices(plan_id, credit_amount, price_cents) values
  ('starter',5,1500),('starter',10,2800),('starter',25,6500),
  ('growth',5,1300),('growth',10,2400),('growth',25,5500),
  ('pro',5,1000),('pro',10,1900),('pro',25,4500),('pro',50,8500),('pro',100,16000)
on conflict (plan_id, credit_amount) do update set price_cents = excluded.price_cents, updated_at = now();
alter table public.booking_credit_refill_prices enable row level security;
drop policy if exists "Public can read refill price catalog" on public.booking_credit_refill_prices;
create policy "Public can read refill price catalog" on public.booking_credit_refill_prices for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.booking_credit_refill_prices from anon, authenticated;
grant select on public.booking_credit_refill_prices to anon, authenticated;

-- Apply the per-booking ceiling in the authoritative database reservation trigger.
create or replace function public.booking_credit_sync_for_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_snapshot jsonb;
  v_eligible bigint;
  v_required integer;
  v_old_required integer := 0;
  v_coverage integer;
  v_cap integer;
  v_available integer := 0;
  v_need integer;
  v_take integer;
  v_release integer;
  v_grant record;
  v_reservation public.booking_credit_reservations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_event text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  -- The trigger owns the credit decision. A caller cannot complete another pro's
  -- booking (or insert an already-accepted booking) to spend their balance.
  if new.status in ('accepted', 'completed')
     and auth.role() is distinct from 'service_role'
     and not public.auth_is_platform_moderator()
     and not exists (
       select 1 from public.pro_profiles p
       where p.id = new.pro_profile_id and p.user_id = auth.uid()
     ) then
    raise exception 'booking_credit_transition_forbidden' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE'
     and old.status in ('accepted', 'completed')
     and new.invoice_snapshot is distinct from old.invoice_snapshot
     and auth.role() is distinct from 'service_role'
     and not public.auth_is_platform_moderator() then
    raise exception 'booking_credit_price_change_requires_server_review' using errcode = '42501';
  end if;

  -- Pending/declined leads and quotes do not consume or reserve credits.
  if new.status in ('accepted', 'completed') then
    v_snapshot := new.invoice_snapshot;
    begin
      v_eligible := coalesce(
        nullif(v_snapshot ->> 'base_amount_cents', '')::bigint,
        round(nullif(v_snapshot ->> 'subtotal', '')::numeric * 100)::bigint
      );
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'booking_credit_invalid_service_value' using errcode = '22023';
    end;
    if v_eligible is null or v_eligible < 0 then
      raise exception 'booking_credit_invalid_service_value' using errcode = '22023';
    end if;
    select coverage_cents, max_credits_per_booking into v_coverage, v_cap from public.booking_credit_config where id = true;
    if v_coverage is null or v_coverage <= 0 or v_cap is null or v_cap <= 0 then
      raise exception 'booking_credit_config_missing' using errcode = '55000';
    end if;
    v_required := case when v_eligible = 0 then 0 else least(v_cap, ((v_eligible + v_coverage - 1) / v_coverage)::integer) end;

    -- Serialize all reservations for one pro, then lock each grant as it is spent.
    perform 1 from public.pro_profiles where id = new.pro_profile_id for update;
    select * into v_reservation from public.booking_credit_reservations
      where booking_id = new.id for update;

    if not found then
      insert into public.booking_credit_reservations(
        booking_id, pro_profile_id, eligible_value_cents, credits_reserved, status
      ) values (new.id, new.pro_profile_id, v_eligible, 0, 'reserved')
      returning * into v_reservation;
    elsif v_reservation.status in ('released', 'refunded') and new.status = 'accepted' then
      delete from public.booking_credit_allocations where reservation_id = v_reservation.id;
      update public.booking_credit_reservations set
        eligible_value_cents = v_eligible, credits_reserved = 0, status = 'reserved', updated_at = v_now
        where id = v_reservation.id returning * into v_reservation;
    end if;

    if v_reservation.status = 'reserved' then
      v_old_required := v_reservation.credits_reserved;
      v_event := 'booking:' || new.id::text || ':' || gen_random_uuid()::text;

      if v_required > v_old_required then
        v_need := v_required - v_old_required;
        select coalesce(sum(g.remaining), 0)::integer into v_available
          from public.booking_credit_grants g
          where g.pro_profile_id = new.pro_profile_id and g.remaining > 0
            and (g.expires_at is null or g.expires_at > v_now);
        if v_available < v_need then
          raise exception 'booking_credits_insufficient: required % available %', v_required, v_old_required + v_available
            using errcode = 'P0001';
        end if;

        for v_grant in
          select g.id, g.remaining from public.booking_credit_grants g
          where g.pro_profile_id = new.pro_profile_id and g.remaining > 0
            and (g.expires_at is null or g.expires_at > v_now)
          order by g.expires_at asc nulls last, g.created_at asc, g.id asc
          for update
        loop
          exit when v_need <= 0;
          v_take := least(v_need, v_grant.remaining);
          update public.booking_credit_grants set remaining = remaining - v_take where id = v_grant.id;
          insert into public.booking_credit_allocations(reservation_id, grant_id, credit_amount)
          values (v_reservation.id, v_grant.id, v_take)
          on conflict (reservation_id, grant_id) do update
            set credit_amount = public.booking_credit_allocations.credit_amount + excluded.credit_amount;
          insert into public.booking_credit_ledger(
            pro_profile_id, booking_id, grant_id, transaction_type, credit_amount, source_reference,
            reason, metadata
          ) values (
            new.pro_profile_id, new.id, v_grant.id, 'booking_credit_reservation', v_take,
            v_event || ':reserve:' || v_grant.id::text, 'Accepted booking credit reservation',
            jsonb_build_object('eligible_value_cents', v_eligible, 'reservation_id', v_reservation.id)
          );
          v_need := v_need - v_take;
        end loop;
      elsif v_required < v_old_required then
        v_release := v_old_required - v_required;
        for v_grant in
          select a.grant_id, a.credit_amount, g.expires_at, g.created_at
          from public.booking_credit_allocations a
          join public.booking_credit_grants g on g.id = a.grant_id
          where a.reservation_id = v_reservation.id and a.credit_amount > 0
          order by g.expires_at desc nulls first, g.created_at desc, a.grant_id desc
          for update of g
        loop
          exit when v_release <= 0;
          v_take := least(v_release, v_grant.credit_amount);
          update public.booking_credit_grants set remaining = remaining + v_take where id = v_grant.grant_id;
          insert into public.booking_credit_ledger(
            pro_profile_id, booking_id, grant_id, transaction_type, credit_amount, source_reference,
            reason, metadata
          ) values (
            new.pro_profile_id, new.id, v_grant.grant_id, 'booking_credit_release', v_take,
            v_event || ':price-release:' || v_grant.grant_id::text, 'Accepted booking value decreased',
            jsonb_build_object('eligible_value_cents', v_eligible, 'reservation_id', v_reservation.id)
          );
          update public.booking_credit_allocations set credit_amount = credit_amount - v_take
            where reservation_id = v_reservation.id and grant_id = v_grant.grant_id;
          v_release := v_release - v_take;
        end loop;
        delete from public.booking_credit_allocations where reservation_id = v_reservation.id and credit_amount = 0;
      end if;
      update public.booking_credit_reservations set eligible_value_cents = v_eligible,
        credits_reserved = v_required, updated_at = v_now where id = v_reservation.id;
    end if;

    -- Completion is the consumption point; grants were already debited at reservation.
    if new.status = 'completed' and v_reservation.status = 'reserved' then
      v_event := 'booking:' || new.id::text || ':' || gen_random_uuid()::text;
      for v_grant in
        select grant_id, credit_amount from public.booking_credit_allocations
        where reservation_id = v_reservation.id and credit_amount > 0
      loop
        insert into public.booking_credit_ledger(
          pro_profile_id, booking_id, grant_id, transaction_type, credit_amount, source_reference,
          reason, metadata
        ) values (
          new.pro_profile_id, new.id, v_grant.grant_id, 'booking_credit_consumption', v_grant.credit_amount,
          v_event || ':consume:' || v_grant.grant_id::text, 'Completed booking',
          jsonb_build_object('eligible_value_cents', v_eligible, 'reservation_id', v_reservation.id)
        );
      end loop;
      update public.booking_credit_reservations set status = 'consumed', updated_at = v_now where id = v_reservation.id;
    end if;
    return new;
  end if;

  -- A cancellation/decline before completion releases only currently reserved credits.
  if new.status in ('cancelled', 'declined') then
    perform 1 from public.pro_profiles where id = new.pro_profile_id for update;
    select * into v_reservation from public.booking_credit_reservations
      where booking_id = new.id and status = 'reserved' for update;
    if found then
      v_event := 'booking:' || new.id::text || ':' || gen_random_uuid()::text;
      for v_grant in
        select a.grant_id, a.credit_amount from public.booking_credit_allocations a
        where a.reservation_id = v_reservation.id and a.credit_amount > 0
        order by a.grant_id
        for update
      loop
        update public.booking_credit_grants set remaining = remaining + v_grant.credit_amount where id = v_grant.grant_id;
        insert into public.booking_credit_ledger(
          pro_profile_id, booking_id, grant_id, transaction_type, credit_amount, source_reference,
          reason, metadata
        ) values (
          v_reservation.pro_profile_id, new.id, v_grant.grant_id, 'booking_credit_release', v_grant.credit_amount,
          v_event || ':release:' || v_grant.grant_id::text, 'Booking canceled before completion',
          jsonb_build_object('reservation_id', v_reservation.id)
        );
      end loop;
      delete from public.booking_credit_allocations where reservation_id = v_reservation.id;
      update public.booking_credit_reservations set status = 'released', updated_at = v_now where id = v_reservation.id;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.booking_credit_sync_for_booking() from public, anon, authenticated;

-- Only the trusted recruitment Edge Function can access contact records.
create table if not exists public.professional_recruitment_contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text,
  business_name text,
  email text,
  phone text,
  website text,
  locale text not null default 'fr' check (locale in ('fr','en')),
  notes text,
  meeting_at timestamptz,
  meeting_url text,
  last_email_template text check (last_email_template in ('first_contact','post_call')),
  last_email_sent_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists professional_recruitment_contacts_created_idx on public.professional_recruitment_contacts(created_at desc);
alter table public.professional_recruitment_contacts enable row level security;
revoke all on public.professional_recruitment_contacts from anon, authenticated;
