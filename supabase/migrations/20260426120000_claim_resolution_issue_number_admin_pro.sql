-- Sequential issue_number for emails; admin resolution labels; admin can update claims + pro tiers.

-- ----- booking_claim_requests: issue_number + admin_resolution -----
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

-- ----- Admin can update pro_profiles (subscription tier, etc.) -----
drop policy if exists "Admin can update any pro profile" on public.pro_profiles;
create policy "Admin can update any pro profile"
  on public.pro_profiles
  for update
  to authenticated
  using (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com')
  with check (lower(trim((auth.jwt() ->> 'email')::text)) = 'premiereservicescontact@gmail.com');
