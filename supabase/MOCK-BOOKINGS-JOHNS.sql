-- ============================================================
-- Mock bookings for John's Plumbing & HVAC (for testing)
-- Run once in Supabase SQL Editor after you have:
--   - A pro_profile with business_name = 'John''s Plumbing & HVAC'
--   - At least one other auth.users row (a client, not that pro)
-- Creates: 1 completed booking (so client can leave a review) + 1 pending (so pro sees decline/approve).
-- ============================================================

INSERT INTO public.bookings (pro_profile_id, client_id, status)
WITH johns AS (
  SELECT id, user_id FROM public.pro_profiles WHERE business_name = 'John''s Plumbing & HVAC' LIMIT 1
),
client AS (
  SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM johns) LIMIT 1
)
SELECT j.id, c.id, 'completed' FROM johns j, client c
WHERE j.id IS NOT NULL AND c.id IS NOT NULL
UNION ALL
SELECT j.id, c.id, 'pending' FROM johns j, client c
WHERE j.id IS NOT NULL AND c.id IS NOT NULL;
