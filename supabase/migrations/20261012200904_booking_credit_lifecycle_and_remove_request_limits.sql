-- Replace per-month request caps with an auditable Booking Credits lifecycle.
-- A lead, quote, or pending booking does not cost credits. Credits are reserved
-- only when a booking becomes accepted, consumed when completed, and released
-- when canceled/declined before completion. The service subtotal is used in
-- integer cents; taxes and platform/processing fees are excluded.

drop trigger if exists trg_bookings_enforce_client_request_limit on public.bookings;
drop trigger if exists trg_job_quotes_enforce_client_request_limit on public.job_quotes;

create or replace function public.pro_client_request_limit(p_tier text)
returns integer language sql immutable set search_path = ''
as $$ select null::integer $$;

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
    select coverage_cents into v_coverage from public.booking_credit_config where id = true;
    if v_coverage is null or v_coverage <= 0 then
      raise exception 'booking_credit_config_missing' using errcode = '55000';
    end if;
    v_required := case when v_eligible = 0 then 0 else ((v_eligible + v_coverage - 1) / v_coverage)::integer end;

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
drop trigger if exists trg_booking_credit_sync on public.bookings;
create trigger trg_booking_credit_sync
  after insert or update of status, invoice_snapshot on public.bookings
  for each row execute function public.booking_credit_sync_for_booking();

comment on column public.booking_credit_reservations.eligible_value_cents is
  'Professional service subtotal in integer CAD cents; excludes tax, tips, refundable deposits, AltShift fees, and processing fees.';
