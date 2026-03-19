-- Run once in Supabase SQL Editor to store client's preferred appointment date on bookings.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS preferred_date date;
COMMENT ON COLUMN public.bookings.preferred_date IS 'Client-selected preferred appointment date (YYYY-MM-DD).';
