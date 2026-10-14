create table if not exists public.pro_application_review_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('approved', 'needs_info')),
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists pro_application_review_notices_user_created_idx
  on public.pro_application_review_notices (user_id, created_at desc);

alter table public.pro_application_review_notices enable row level security;

drop policy if exists pro_application_review_notices_select_own
  on public.pro_application_review_notices;
create policy pro_application_review_notices_select_own
  on public.pro_application_review_notices
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.pro_application_review_notices from anon, authenticated;
grant select on public.pro_application_review_notices to authenticated;

comment on table public.pro_application_review_notices is
  'Private, user-readable decisions and missing-information requests for pro applications; writes are server-only.';
