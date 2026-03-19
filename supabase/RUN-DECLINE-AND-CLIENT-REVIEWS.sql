-- ============================================================
-- Paste and run this in Supabase SQL Editor (once).
-- Adds: decline_reason on bookings, status 'declined', client_reviews.
-- ============================================================

-- 1) Allow pros to decline a booking with a reason (e.g. email body).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS decline_reason text;

-- Allow status 'declined' (ensure CHECK includes it)
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled', 'declined'));

-- 2) Pros can review clients (so other pros see how good the client is).
CREATE TABLE IF NOT EXISTS public.client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pro_profile_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_reviews_client ON public.client_reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_pro ON public.client_reviews(pro_profile_id);

ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pros can insert client review" ON public.client_reviews;
CREATE POLICY "Pros can insert client review" ON public.client_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Pros can update own client review" ON public.client_reviews;
CREATE POLICY "Pros can update own client review" ON public.client_reviews FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can read client reviews" ON public.client_reviews;
CREATE POLICY "Anyone can read client reviews" ON public.client_reviews FOR SELECT USING (true);
