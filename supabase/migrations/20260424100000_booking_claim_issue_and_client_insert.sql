-- Allow claim_type "issue" (report an issue; refund/redo decided by support later).
-- Allow clients to insert their own rows so the report is saved even if the email edge function fails.

alter table public.booking_claim_requests
  drop constraint if exists booking_claim_requests_claim_type_check;

alter table public.booking_claim_requests
  add constraint booking_claim_requests_claim_type_check
  check (claim_type in ('refund', 'redo', 'issue'));

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
