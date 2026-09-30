-- Track 24h SMS reminders so we don't double-send.
alter table public.bookings
  add column if not exists sms_reminder_sent_at timestamptz;

comment on column public.bookings.sms_reminder_sent_at is
  'When the ~24h pre-appointment SMS reminder was sent to client/pro (null = not sent).';
