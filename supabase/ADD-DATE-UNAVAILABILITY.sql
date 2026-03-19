-- Date-specific unavailability and availability overrides for pros.
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- unavailable_dates: JSONB map of date (YYYY-MM-DD) -> true (whole day) or array of { "start": "HH:mm", "end": "HH:mm" }
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS unavailable_dates jsonb DEFAULT '{}';

-- available_date_overrides: JSONB array of date strings when pro is available despite weekday saying unavailable
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS available_date_overrides jsonb DEFAULT '[]';

COMMENT ON COLUMN public.pro_profiles.unavailable_dates IS 'Specific dates unavailability: {"2025-03-15": true} or {"2025-03-16": [{"start":"15:00","end":"18:00"}]}';
COMMENT ON COLUMN public.pro_profiles.available_date_overrides IS 'Dates when pro is available even if weekday is not: ["2025-03-20"]';
