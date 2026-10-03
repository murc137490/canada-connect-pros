-- Pro-tier SMS automation prefs + booking assistant messages
alter table public.pro_profiles
  add column if not exists sms_reminder_hours integer not null default 24,
  add column if not exists sms_reminder_message_custom text,
  add column if not exists sms_confirmation_message_custom text,
  add column if not exists sms_review_request_message_custom text;

alter table public.pro_profiles
  drop constraint if exists pro_profiles_sms_reminder_hours_chk;
alter table public.pro_profiles
  add constraint pro_profiles_sms_reminder_hours_chk
  check (sms_reminder_hours in (24, 48, 72));

alter table public.bookings
  add column if not exists sms_review_request_sent_at timestamptz;

create table if not exists public.booking_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_role text not null check (sender_role in ('client', 'pro', 'assistant')),
  sender_user_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_assistant_messages_booking
  on public.booking_assistant_messages (booking_id, created_at);

alter table public.booking_assistant_messages enable row level security;

-- Parties on the booking can read/write thread messages (assistant inserts as authenticated user)
drop policy if exists "Booking parties read assistant messages" on public.booking_assistant_messages;
create policy "Booking parties read assistant messages"
  on public.booking_assistant_messages for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      left join public.pro_profiles p on p.id = b.pro_profile_id
      where b.id = booking_assistant_messages.booking_id
        and (b.client_id = auth.uid() or p.user_id = auth.uid())
    )
  );

drop policy if exists "Booking parties insert assistant messages" on public.booking_assistant_messages;
create policy "Booking parties insert assistant messages"
  on public.booking_assistant_messages for insert to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      left join public.pro_profiles p on p.id = b.pro_profile_id
      where b.id = booking_assistant_messages.booking_id
        and (b.client_id = auth.uid() or p.user_id = auth.uid())
    )
    and (
      sender_user_id is null
      or sender_user_id = auth.uid()
    )
  );
