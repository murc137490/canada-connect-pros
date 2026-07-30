-- ============================================================================
-- Paste this entire file into Supabase → SQL Editor → Run once (safe to re-run)
-- Booking issue reports + booking-evidence storage bucket + RLS
-- ============================================================================

-- ----- A) Table: booking_claim_requests -----
create table if not exists public.booking_claim_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  client_id uuid not null,
  pro_profile_id uuid not null references public.pro_profiles (id) on delete restrict,
  claim_type text not null check (claim_type in ('refund', 'redo', 'issue')),
  message text not null,
  attachment_urls text[] not null default '{}'::text[],
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'closed')),
  created_at timestamptz not null default now()
);

-- If table already existed with an old constraint, widen claim_type:
alter table public.booking_claim_requests
  drop constraint if exists booking_claim_requests_claim_type_check;

alter table public.booking_claim_requests
  add constraint booking_claim_requests_claim_type_check
  check (claim_type in ('refund', 'redo', 'issue'));

create index if not exists booking_claim_requests_pending_idx
  on public.booking_claim_requests (status, created_at desc);

alter table public.booking_claim_requests enable row level security;

drop policy if exists "Admin can read booking claim requests" on public.booking_claim_requests;
create policy "Admin can read booking claim requests"
  on public.booking_claim_requests
  for select
  to authenticated
  using (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com');

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

-- ----- B) Storage bucket: booking-evidence -----
insert into storage.buckets (id, name, public)
values ('booking-evidence', 'booking-evidence', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can read booking-evidence" on storage.objects;
create policy "Anyone can read booking-evidence"
  on storage.objects for select
  to public
  using (bucket_id = 'booking-evidence');

drop policy if exists "Booking parties can upload booking-evidence" on storage.objects;
create policy "Booking parties can upload booking-evidence"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Booking parties can update booking-evidence" on storage.objects;
create policy "Booking parties can update booking-evidence"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Booking parties can delete booking-evidence" on storage.objects;
create policy "Booking parties can delete booking-evidence"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      where b.id::text = split_part(name, '/', 1)
      and (
        b.client_id = auth.uid()
        or exists (
          select 1 from public.pro_profiles p
          where p.id = b.pro_profile_id and p.user_id = auth.uid()
        )
      )
    )
  );

-- ----- C) Issue numbers, admin resolution, admin can update claims + all pros -----
alter table public.booking_claim_requests add column if not exists issue_number integer;
alter table public.booking_claim_requests add column if not exists admin_resolution text;

alter table public.booking_claim_requests drop constraint if exists booking_claim_requests_admin_resolution_check;
alter table public.booking_claim_requests add constraint booking_claim_requests_admin_resolution_check
  check (admin_resolution is null or admin_resolution in ('refunded', 'job_redone', 'resolved'));

create sequence if not exists public.booking_claim_issue_number_seq;

with numbered as (
  select id, row_number() over (order by created_at asc) as n
  from public.booking_claim_requests
  where issue_number is null
)
update public.booking_claim_requests c
set issue_number = numbered.n
from numbered
where c.id = numbered.id;

update public.booking_claim_requests
set issue_number = nextval('public.booking_claim_issue_number_seq')
where issue_number is null;

alter table public.booking_claim_requests alter column issue_number set default nextval('public.booking_claim_issue_number_seq');

select setval(
  'public.booking_claim_issue_number_seq',
  coalesce((select max(issue_number) from public.booking_claim_requests), 1)
);

alter table public.booking_claim_requests alter column issue_number set not null;

create unique index if not exists booking_claim_requests_issue_number_uidx on public.booking_claim_requests (issue_number);

drop policy if exists "Admin can update booking claim requests" on public.booking_claim_requests;
create policy "Admin can update booking claim requests"
  on public.booking_claim_requests
  for update
  to authenticated
  using (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com')
  with check (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com');

drop policy if exists "Admin can update any pro profile" on public.pro_profiles;
create policy "Admin can update any pro profile"
  on public.pro_profiles
  for update
  to authenticated
  using (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com')
  with check (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com');

-- Admin list + tier column: if missing, API returns 0 rows when selecting subscription_tier
alter table public.pro_profiles add column if not exists subscription_tier text default 'starter';

-- Re-assert public read of pro directory (in case a project had RLS without SELECT)
drop policy if exists "Anyone can view pro profiles" on public.pro_profiles;
create policy "Anyone can view pro profiles" on public.pro_profiles for select using (true);
