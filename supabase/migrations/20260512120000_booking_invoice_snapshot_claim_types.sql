-- Full invoice snapshot on bookings + payment row ownership for client-side link after checkout.
-- Extended booking claim types for payment, service, and cancellation reports.

-- ----- bookings.invoice_snapshot -----
alter table public.bookings add column if not exists invoice_snapshot jsonb;

comment on column public.bookings.invoice_snapshot is
  'Immutable checkout snapshot: service, schedule, tax breakdown, Square payment id, renewal flags.';

-- ----- payments.client_id + client can attach booking_id after booking insert -----
alter table public.payments add column if not exists client_id uuid references auth.users (id) on delete set null;

create index if not exists idx_payments_client_id on public.payments (client_id) where client_id is not null;

drop policy if exists "Clients can link booking to own payment" on public.payments;
create policy "Clients can link booking to own payment"
  on public.payments
  for update
  to authenticated
  using (client_id = auth.uid() and booking_id is null)
  with check (
    client_id = auth.uid()
    and booking_id is not null
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.client_id = auth.uid()
    )
  );

-- ----- booking_claim_requests: broader claim_type -----
alter table public.booking_claim_requests
  drop constraint if exists booking_claim_requests_claim_type_check;

alter table public.booking_claim_requests
  add constraint booking_claim_requests_claim_type_check
  check (
    claim_type in (
      'refund',
      'redo',
      'issue',
      'payment_problem',
      'service_problem',
      'cancellation'
    )
  );

-- Clients can read their own reports (dashboard / invoices follow-up).
drop policy if exists "Clients can read own booking claims" on public.booking_claim_requests;
create policy "Clients can read own booking claims"
  on public.booking_claim_requests
  for select
  to authenticated
  using (client_id = auth.uid());
