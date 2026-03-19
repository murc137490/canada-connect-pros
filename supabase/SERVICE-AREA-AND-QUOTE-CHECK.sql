-- =============================================================================
-- Map + radius (service area) + "Check if we serve you" (quote / postal code)
-- Run once in Supabase SQL Editor. Run after RUN-THIS-ONCE-CREATE-TABLES.sql.
-- =============================================================================

-- 1) Pro service area: radius in km (centre = latitude, longitude; pro sets this on the map)
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,2);

COMMENT ON COLUMN public.pro_profiles.service_radius_km IS 'Service area radius in km from latitude/longitude. Used to tell clients if pro serves their area (postal code or address).';

-- 2) Haversine distance in km (for use in get_pros_serving_point)
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

-- 3) Pros that serve a given point (lat/lng). Used when client enters postal code or address for a quote.
--    Frontend geocodes postal code (or address) to lat/lng, then calls this RPC.
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
