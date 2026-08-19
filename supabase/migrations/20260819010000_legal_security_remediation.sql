-- Remediation: legal acceptances, claims enrichment, deletion requests, incidents,
-- private evidence storage, tighter bookings RLS, ID verification status for pros.

-- 1) Versioned legal document acceptances (append-only)
create table if not exists public.legal_document_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  document_version text not null,
  document_hash text not null,
  language_displayed text not null check (language_displayed in ('en', 'fr')),
  language_selected text not null check (language_selected in ('en', 'fr')),
  context text,
  booking_id uuid references public.bookings(id) on delete set null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists legal_document_acceptances_user_idx
  on public.legal_document_acceptances (user_id, accepted_at desc);

alter table public.legal_document_acceptances enable row level security;

drop policy if exists "Users insert own legal acceptances" on public.legal_document_acceptances;
create policy "Users insert own legal acceptances"
  on public.legal_document_acceptances for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own legal acceptances" on public.legal_document_acceptances;
create policy "Users read own legal acceptances"
  on public.legal_document_acceptances for select to authenticated
  using (auth.uid() = user_id);

-- 2) Account deletion requests (do not auto-wipe financial records)
create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected', 'partial')),
  reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  admin_notes text,
  retain_financial boolean not null default true,
  retain_audit boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users insert own deletion requests" on public.account_deletion_requests;
create policy "Users insert own deletion requests"
  on public.account_deletion_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users read own deletion requests" on public.account_deletion_requests;
create policy "Users read own deletion requests"
  on public.account_deletion_requests for select to authenticated
  using (auth.uid() = user_id);

-- 3) Privacy / security incident register (admin-only via service role / platform admin policies later)
create table if not exists public.privacy_security_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_code text unique,
  date_discovered date,
  date_occurred date,
  system_name text,
  data_affected text,
  users_affected_estimate integer,
  severity text check (severity in ('low', 'medium', 'high', 'critical')),
  containment text,
  investigation text,
  resolution text,
  notification_review text,
  legal_review_required boolean not null default true,
  responsible_person text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.privacy_security_incidents enable row level security;
-- No anon/authenticated policies: service_role / future admin-only policies only.

-- 4) Claims workflow enrichment
alter table public.booking_claim_requests
  add column if not exists issue_category text,
  add column if not exists workflow_status text,
  add column if not exists investigation_notes text,
  add column if not exists resolution_summary text,
  add column if not exists refund_amount_cents integer,
  add column if not exists replacement_status text,
  add column if not exists reperformance_status text,
  add column if not exists policy_version text;

-- Map legacy status into workflow_status when null
update public.booking_claim_requests
set workflow_status = case
  when status = 'pending' then 'OPEN'
  when status = 'reviewed' then 'UNDER_REVIEW'
  when status = 'closed' then 'RESOLVED'
  else coalesce(workflow_status, 'OPEN')
end
where workflow_status is null;

-- 5) Client ID: verification status for pros (not the image)
alter table public.profiles
  add column if not exists booking_id_verification_status text
    default 'none';

update public.profiles
set booking_id_verification_status = 'verified'
where booking_id_verification_photo_path is not null
  and coalesce(booking_id_verification_status, 'none') = 'none';

-- 6) Tighten bookings SELECT — replace open "Anyone can view bookings" if present
drop policy if exists "Anyone can view bookings" on public.bookings;

drop policy if exists "Clients and pros can view own bookings" on public.bookings;
create policy "Clients and pros can view own bookings"
  on public.bookings for select to authenticated
  using (
    auth.uid() = client_id
    or exists (
      select 1 from public.pro_profiles p
      where p.id = bookings.pro_profile_id and p.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles pr
      where pr.user_id = auth.uid() and coalesce(pr.is_platform_admin, false) = true
    )
  );

-- 7) Storage: make booking-evidence private
update storage.buckets set public = false where id = 'booking-evidence';

drop policy if exists "Anyone can read booking-evidence" on storage.objects;
drop policy if exists "Public read booking-evidence" on storage.objects;

drop policy if exists "Booking parties read booking-evidence" on storage.objects;
create policy "Booking parties read booking-evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'booking-evidence'
    and exists (
      select 1 from public.bookings b
      left join public.pro_profiles p on p.id = b.pro_profile_id
      where b.id::text = (storage.foldername(name))[1]
        and (b.client_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- 8) Remove pro ability to SELECT client ID verification objects (status only in app)
drop policy if exists "Pros can read client booking verification for their bookings" on storage.objects;
drop policy if exists "Pros read client-booking-verification" on storage.objects;

-- Keep owner access on client-booking-verification (existing policies)
