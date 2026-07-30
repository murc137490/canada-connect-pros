-- Pending booking claims (refund / redo) for admin review.
-- Rows are inserted by the send-booking-claim-email edge function (service role).

create table if not exists public.booking_claim_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  client_id uuid not null,
  pro_profile_id uuid not null references public.pro_profiles (id) on delete restrict,
  claim_type text not null check (claim_type in ('refund', 'redo')),
  message text not null,
  attachment_urls text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists booking_claim_requests_pending_idx
  on public.booking_claim_requests (status, created_at desc);

alter table public.booking_claim_requests enable row level security;

-- Only the platform admin account (by JWT email) can read claims in the dashboard.
drop policy if exists "Admin can read booking claim requests" on public.booking_claim_requests;
create policy "Admin can read booking claim requests"
  on public.booking_claim_requests
  for select
  to authenticated
  using (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com');
