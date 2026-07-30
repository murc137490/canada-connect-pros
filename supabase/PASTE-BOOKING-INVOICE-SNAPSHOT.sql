-- Paste in Supabase SQL Editor if booking checkout fails on missing invoice_snapshot.
-- Safe to run more than once.

alter table public.bookings add column if not exists invoice_snapshot jsonb;

comment on column public.bookings.invoice_snapshot is
  'Immutable checkout snapshot: service, schedule, tax breakdown, Square payment id, renewal flags.';
