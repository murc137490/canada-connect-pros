# Copy-paste: SQL + deploy Edge Function (no Supabase CLI)

## 1. SQL — run in Supabase Dashboard

**Supabase Dashboard** → your project → **SQL Editor** → **New query**.

**Optional (workspace vs travel):** Run `supabase/ADD-SERVICE-AT-WORKSPACE-ONLY.sql` once to add `service_at_workspace_only` to `pro_profiles`.

**Optional (Pro dashboard stats):** Run `supabase/ADD-PRO-PROFILE-VIEWS-AND-RANK.sql` once to add profile views (clicks) and rank for the Pro file tab in the dashboard.

**Optional (Decline booking + Pro reviews client):** Run `supabase/ADD-BOOKING-DECLINE-AND-CLIENT-REVIEWS.sql` once to add decline_reason to bookings and the client_reviews table so pros can decline with a reason and review clients.

**Optional (Mock data for testing):** Run `supabase/MOCK-BOOKINGS-JOHNS.sql` once to insert one completed and one pending booking for "John's Plumbing & HVAC" (so you can test the review flow and the decline/approve forms). Requires that pro and at least one other user exist.

**Admin accept:** The admin page at /admin is only for the hardcoded admin (email murc137490@gmail.com or username aymen). Deploy the Edge Function `accept-pro` (see `supabase/functions/accept-pro/index.ts`). Log in as that admin and use /admin to accept pending pros and give them access to the pro section.

**Accept via SQL (alternative):** Run `supabase/ACCEPT-USER-AS-PRO.sql` in SQL Editor (replace UID/name) to set a user as verified pro.

Then paste the block below and click **Run**.

```sql
-- Optional migrations: service area (map + radius), quote check, profiles, bookings, top picks
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,2);

COMMENT ON COLUMN public.pro_profiles.service_radius_km IS 'Service area radius in km from latitude/longitude.';

CREATE OR REPLACE FUNCTION public.distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT (6371 * acos(least(1::double precision, greatest(-1::double precision,
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + sin(radians(lat1)) * sin(radians(lat2))
  ))))::double precision;
$$;

CREATE OR REPLACE FUNCTION public.get_pros_serving_point(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE(
  pro_profile_id uuid,
  business_name text,
  location text,
  service_radius_km numeric,
  distance_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    pp.id,
    pp.business_name,
    pp.location,
    pp.service_radius_km,
    public.distance_km(pp.latitude::double precision, pp.longitude::double precision, p_lat, p_lng) AS distance_km
  FROM public.pro_profiles pp
  WHERE pp.is_verified = true
    AND pp.latitude IS NOT NULL
    AND pp.longitude IS NOT NULL
    AND pp.service_radius_km IS NOT NULL
    AND public.distance_km(pp.latitude::double precision, pp.longitude::double precision, p_lat, p_lng) <= pp.service_radius_km
  ORDER BY distance_km ASC;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS address text;

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_pro_profile ON public.bookings(pro_profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(pro_profile_id, status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bookings count" ON public.bookings;
CREATE POLICY "Anyone can view bookings" ON public.bookings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can create booking" ON public.bookings;
CREATE POLICY "Authenticated can create booking" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Pro can update own booking" ON public.bookings;
CREATE POLICY "Pro can update own booking" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_top_picks(p_category_slug text)
RETURNS TABLE(
  pro_profile_id uuid,
  business_name text,
  avg_rating numeric,
  review_count bigint,
  booking_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pro_rating AS (
    SELECT pp.id, pp.business_name,
           (SELECT COALESCE(AVG(r.rating), 0)::numeric(3,2) FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS avg_rating,
           (SELECT COUNT(*)::bigint FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS review_count,
           (SELECT COUNT(*)::bigint FROM public.bookings b WHERE b.pro_profile_id = pp.id AND b.status = 'completed') AS booking_count
    FROM public.pro_profiles pp
    WHERE pp.is_verified = true
      AND EXISTS (SELECT 1 FROM public.pro_services ps WHERE ps.pro_profile_id = pp.id AND ps.category_slug = p_category_slug)
  )
  SELECT pr.id, pr.business_name, pr.avg_rating, pr.review_count, pr.booking_count
  FROM pro_rating pr
  WHERE (pr.booking_count >= 50 OR pr.review_count >= 40)
  ORDER BY pr.avg_rating DESC NULLS LAST, pr.review_count DESC
  LIMIT 3;
$$;
```

---

## 2. Stripe (REMOVED / DEPRECATED)

> **Note:** Stripe has been completely removed from the project. Booking payments use **Square Web Payments SDK + Square Connect** (see Section 4). The `create-payment-intent` function is no longer used or present.

---

## 3. Commands to run locally (no Supabase CLI)

In PowerShell, from the project folder:

```powershell
cd "c:\Users\aymen\Downloads\canada-connect-pros-main\canada-connect-pros-main"
npm run dev
```

- App runs at **http://localhost:5173** (or the port Vite shows).
- To check build: `npm run build`.

You do **not** need `supabase` in the terminal; SQL and the Edge Function are done in the Supabase Dashboard.

---

## 4. Square (booking payments) & Twilio Verify (SMS OTP)

**Booking payments** use **Square** (replacing Stripe). **SMS one-time codes** use **Twilio Verify**.

### Square

- Deploy: `supabase functions deploy square-create-payment`
- Secrets: `SQUARE_ACCESS_TOKEN`, optionally `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT` (see **docs/SQUARE-SETUP.md**).
- Frontend: set `VITE_SQUARE_APPLICATION_ID` and `VITE_SQUARE_LOCATION_ID` in `.env`. See **docs/SQUARE-SETUP.md** for where to find these in the Square Developer Dashboard.

### Twilio Verify (SMS OTP / 2FA)

- Deploy: `supabase functions deploy twilio-verify`
- Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (see **docs/TWILIO-VERIFY-SETUP.md**).
- Example: send code to `+14505784500`, then check with `code: "4977"`.
