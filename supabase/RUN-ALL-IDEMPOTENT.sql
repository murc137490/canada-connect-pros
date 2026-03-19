-- =============================================================================
-- RUN ALL (idempotent) — paste into Supabase SQL Editor and Run.
-- Safe to run multiple times. Run in one go or in two parts if needed.
-- =============================================================================

-- 1) Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Pro profiles
CREATE TABLE IF NOT EXISTS public.pro_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name text NOT NULL,
  bio text,
  location text,
  latitude double precision,
  longitude double precision,
  price_min numeric(10,2),
  price_max numeric(10,2),
  availability text DEFAULT 'available',
  phone text,
  website text,
  years_experience integer DEFAULT 0,
  is_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view pro profiles" ON public.pro_profiles;
DROP POLICY IF EXISTS "Pros can insert their own profile" ON public.pro_profiles;
DROP POLICY IF EXISTS "Pros can update their own profile" ON public.pro_profiles;
DROP POLICY IF EXISTS "Pros can delete their own profile" ON public.pro_profiles;
CREATE POLICY "Anyone can view pro profiles" ON public.pro_profiles FOR SELECT USING (true);
CREATE POLICY "Pros can insert their own profile" ON public.pro_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pros can update their own profile" ON public.pro_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Pros can delete their own profile" ON public.pro_profiles FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_pro_profiles_updated_at ON public.pro_profiles;
CREATE TRIGGER update_pro_profiles_updated_at BEFORE UPDATE ON public.pro_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Pro services, photos, licenses
CREATE TABLE IF NOT EXISTS public.pro_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  service_slug text NOT NULL,
  category_slug text NOT NULL,
  custom_price_min numeric(10,2),
  custom_price_max numeric(10,2),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view pro services" ON public.pro_services;
DROP POLICY IF EXISTS "Pros can manage their services" ON public.pro_services;
DROP POLICY IF EXISTS "Pros can update their services" ON public.pro_services;
DROP POLICY IF EXISTS "Pros can delete their services" ON public.pro_services;
CREATE POLICY "Anyone can view pro services" ON public.pro_services FOR SELECT USING (true);
CREATE POLICY "Pros can manage their services" ON public.pro_services FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their services" ON public.pro_services FOR UPDATE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their services" ON public.pro_services FOR DELETE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.pro_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view pro photos" ON public.pro_photos;
DROP POLICY IF EXISTS "Pros can manage their photos" ON public.pro_photos;
DROP POLICY IF EXISTS "Pros can update their photos" ON public.pro_photos;
DROP POLICY IF EXISTS "Pros can delete their photos" ON public.pro_photos;
CREATE POLICY "Anyone can view pro photos" ON public.pro_photos FOR SELECT USING (true);
CREATE POLICY "Pros can manage their photos" ON public.pro_photos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their photos" ON public.pro_photos FOR UPDATE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their photos" ON public.pro_photos FOR DELETE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.pro_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  license_number text NOT NULL,
  license_type text NOT NULL DEFAULT 'RBQ',
  holder_name text,
  is_verified boolean DEFAULT false,
  verification_data jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view verified licenses" ON public.pro_licenses;
DROP POLICY IF EXISTS "Pros can add their licenses" ON public.pro_licenses;
DROP POLICY IF EXISTS "Pros can update their licenses" ON public.pro_licenses;
DROP POLICY IF EXISTS "Pros can delete their licenses" ON public.pro_licenses;
CREATE POLICY "Anyone can view verified licenses" ON public.pro_licenses FOR SELECT USING (true);
CREATE POLICY "Pros can add their licenses" ON public.pro_licenses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their licenses" ON public.pro_licenses FOR UPDATE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their licenses" ON public.pro_licenses FOR DELETE USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

-- 4) Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update their reviews" ON public.reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete their reviews" ON public.reviews FOR DELETE USING (auth.uid() = reviewer_id);
DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view review photos" ON public.review_photos;
DROP POLICY IF EXISTS "Reviewers can add photos" ON public.review_photos;
DROP POLICY IF EXISTS "Reviewers can delete their photos" ON public.review_photos;
CREATE POLICY "Anyone can view review photos" ON public.review_photos FOR SELECT USING (true);
CREATE POLICY "Reviewers can add photos" ON public.review_photos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.reviews WHERE id = review_id AND reviewer_id = auth.uid()));
CREATE POLICY "Reviewers can delete their photos" ON public.review_photos FOR DELETE USING (EXISTS (SELECT 1 FROM public.reviews WHERE id = review_id AND reviewer_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE UNIQUE,
  pro_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view review responses" ON public.review_responses;
DROP POLICY IF EXISTS "Pros can respond to their reviews" ON public.review_responses;
DROP POLICY IF EXISTS "Pros can update their responses" ON public.review_responses;
DROP POLICY IF EXISTS "Pros can delete their responses" ON public.review_responses;
CREATE POLICY "Anyone can view review responses" ON public.review_responses FOR SELECT USING (true);
CREATE POLICY "Pros can respond to their reviews" ON public.review_responses FOR INSERT WITH CHECK (auth.uid() = pro_user_id AND EXISTS (SELECT 1 FROM public.reviews r JOIN public.pro_profiles pp ON r.pro_profile_id = pp.id WHERE r.id = review_id AND pp.user_id = auth.uid()));
CREATE POLICY "Pros can update their responses" ON public.review_responses FOR UPDATE USING (auth.uid() = pro_user_id);
CREATE POLICY "Pros can delete their responses" ON public.review_responses FOR DELETE USING (auth.uid() = pro_user_id);

CREATE OR REPLACE FUNCTION public.get_pro_avg_rating(p_pro_profile_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(AVG(rating)::numeric(3,2), 0), COUNT(*) FROM public.reviews WHERE pro_profile_id = p_pro_profile_id;
$$;

INSERT INTO storage.buckets (id, name, public) VALUES ('pro-photos', 'pro-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true) ON CONFLICT (id) DO NOTHING;

-- 5) handle_new_user (basic: no email_language yet)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) Optional columns: profiles (phone, birthday, address), pro_profiles (service_at_workspace_only, service_radius_km, email_language), profiles (email_language)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS birthday date, ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS service_at_workspace_only boolean DEFAULT false;
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS service_radius_km numeric(6,2);
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));
ALTER TABLE public.pro_profiles ADD COLUMN IF NOT EXISTS personal_photo_url text, ADD COLUMN IF NOT EXISTS id_document_url text;

-- 7) distance_km + get_pros_serving_point
CREATE OR REPLACE FUNCTION public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT (6371 * acos(least(1::double precision, greatest(-1::double precision,
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + sin(radians(lat1)) * sin(radians(lat2))
  ))))::double precision;
$$;

CREATE OR REPLACE FUNCTION public.get_pros_serving_point(p_lat double precision, p_lng double precision)
RETURNS TABLE(pro_profile_id uuid, business_name text, location text, service_radius_km numeric, distance_km double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.id, pp.business_name, pp.location, pp.service_radius_km,
    public.distance_km(pp.latitude::double precision, pp.longitude::double precision, p_lat, p_lng) AS distance_km
  FROM public.pro_profiles pp
  WHERE pp.is_verified = true AND pp.latitude IS NOT NULL AND pp.longitude IS NOT NULL AND pp.service_radius_km IS NOT NULL
    AND public.distance_km(pp.latitude::double precision, pp.longitude::double precision, p_lat, p_lng) <= pp.service_radius_km
  ORDER BY distance_km ASC;
$$;

-- 8) Bookings + get_top_picks (with correct DROP so re-run works)
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
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;
CREATE POLICY "Anyone can view bookings" ON public.bookings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can create booking" ON public.bookings;
CREATE POLICY "Authenticated can create booking" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Pro can update own booking" ON public.bookings;
CREATE POLICY "Pro can update own booking" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_top_picks(p_category_slug text)
RETURNS TABLE(pro_profile_id uuid, business_name text, avg_rating numeric, review_count bigint, booking_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pro_rating AS (
    SELECT pp.id, pp.business_name,
           (SELECT COALESCE(AVG(r.rating), 0)::numeric(3,2) FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS avg_rating,
           (SELECT COUNT(*)::bigint FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS review_count,
           (SELECT COUNT(*)::bigint FROM public.bookings b WHERE b.pro_profile_id = pp.id AND b.status = 'completed') AS booking_count
    FROM public.pro_profiles pp
    WHERE pp.is_verified = true AND EXISTS (SELECT 1 FROM public.pro_services ps WHERE ps.pro_profile_id = pp.id AND ps.category_slug = p_category_slug)
  )
  SELECT pr.id, pr.business_name, pr.avg_rating, pr.review_count, pr.booking_count
  FROM pro_rating pr
  WHERE (pr.booking_count >= 50 OR pr.review_count >= 40)
  ORDER BY pr.avg_rating DESC NULLS LAST, pr.review_count DESC LIMIT 3;
$$;

-- 9) Decline + client_reviews
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'completed', 'cancelled', 'declined'));

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

-- 10) handle_new_user with email_language + get_pro_and_user (overwrites basic handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_language)
  VALUES (NEW.id, NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en'));
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  UPDATE public.profiles SET full_name = NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), email_language = COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en') WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pro_and_user(pro_user_id uuid)
RETURNS TABLE(user_id uuid, email text, business_name text, email_language text) AS $$
  SELECT u.id, u.email::text, pp.business_name, COALESCE(NULLIF(pp.email_language, ''), p.email_language, 'en')::text
  FROM auth.users u
  JOIN public.pro_profiles pp ON pp.user_id = u.id
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = pro_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 11) Storage RLS for pro-photos
DROP POLICY IF EXISTS "Authenticated can upload pro-photos" ON storage.objects;
CREATE POLICY "Authenticated can upload pro-photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pro-photos' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Anyone can read pro-photos" ON storage.objects;
CREATE POLICY "Anyone can read pro-photos" ON storage.objects FOR SELECT USING (bucket_id = 'pro-photos');
DROP POLICY IF EXISTS "Users can update own pro-photos" ON storage.objects;
CREATE POLICY "Users can update own pro-photos" ON storage.objects FOR UPDATE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can delete own pro-photos" ON storage.objects;
CREATE POLICY "Users can delete own pro-photos" ON storage.objects FOR DELETE USING (bucket_id = 'pro-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
