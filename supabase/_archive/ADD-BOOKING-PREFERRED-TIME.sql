-- Run once in Supabase SQL Editor to store client's preferred appointment start time on bookings.
-- Used for showing the exact start time in the pro booking history calendar.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS preferred_time time;

COMMENT ON COLUMN public.bookings.preferred_time IS 'Client-selected preferred appointment start time (HH:MM).';

