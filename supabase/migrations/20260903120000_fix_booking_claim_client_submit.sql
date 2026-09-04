-- Allow app claim_type / dispute_category values and fix client RLS for report submit.
-- Root cause of 403 on submit: claim_type check rejected service_problem/payment_problem,
-- and clients lacked SELECT so insert().select() failed.

alter table public.booking_claim_requests
  drop constraint if exists booking_claim_requests_claim_type_check;

alter table public.booking_claim_requests
  add constraint booking_claim_requests_claim_type_check
  check (
    claim_type = any (array[
      'refund'::text,
      'redo'::text,
      'issue'::text,
      'payment_problem'::text,
      'service_problem'::text,
      'cancellation'::text
    ])
  );

alter table public.booking_claim_requests
  drop constraint if exists booking_claim_requests_dispute_category_check;

alter table public.booking_claim_requests
  add constraint booking_claim_requests_dispute_category_check
  check (
    dispute_category is null
    or dispute_category = any (array[
      'provider_never_arrived'::text,
      'incomplete_service'::text,
      'partial_incomplete_service'::text,
      'service_differed_from_booking'::text,
      'visible_damage'::text,
      'wrong_service'::text,
      'major_quality_issue'::text,
      'safety_issue'::text,
      'unauthorized_charges'::text,
      'other_issue'::text
    ])
  );

drop policy if exists "Clients can insert own booking claims" on public.booking_claim_requests;
create policy "Clients can insert own booking claims"
  on public.booking_claim_requests
  for insert
  to authenticated
  with check (
    client_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.client_id = auth.uid()
        and b.pro_profile_id = pro_profile_id
    )
  );

drop policy if exists "Clients can read own booking claims" on public.booking_claim_requests;
create policy "Clients can read own booking claims"
  on public.booking_claim_requests
  for select
  to authenticated
  using (client_id = auth.uid());
