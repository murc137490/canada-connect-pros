create table if not exists public.professional_recruitment_replies (
  id uuid primary key default gen_random_uuid(),
  resend_email_id text not null unique,
  resend_webhook_id text unique,
  contact_id uuid references public.professional_recruitment_contacts(id) on delete set null,
  draft_id uuid references public.professional_recruitment_email_drafts(id) on delete set null,
  sender_email text not null,
  recipient_emails text[] not null default '{}',
  subject text not null default '',
  body_text text not null default '',
  message_id text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists professional_recruitment_replies_received_idx
  on public.professional_recruitment_replies (received_at desc);
create index if not exists professional_recruitment_replies_contact_idx
  on public.professional_recruitment_replies (contact_id, received_at desc);

alter table public.professional_recruitment_replies enable row level security;
revoke all on public.professional_recruitment_replies from anon, authenticated;
