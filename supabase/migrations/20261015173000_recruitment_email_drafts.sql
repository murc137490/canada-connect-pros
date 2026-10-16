create table if not exists public.professional_recruitment_email_drafts (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.professional_recruitment_contacts(id) on delete cascade,
  template text not null check (template in ('first_contact','post_call')),
  recipient_email text not null,
  subject text not null check (length(trim(subject)) between 1 and 240),
  body text not null check (length(trim(body)) between 1 and 20000),
  status text not null default 'pending' check (status in ('pending','sending','sent','rejected')),
  created_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_recruitment_email_drafts_pending_idx
  on public.professional_recruitment_email_drafts (created_at desc)
  where status = 'pending';

alter table public.professional_recruitment_email_drafts enable row level security;
revoke all on public.professional_recruitment_email_drafts from anon, authenticated;
