-- =============================================================================
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → paste → Run
-- This creates the tables required for the app and for the mock John seed.
-- If you get "already exists" errors, the tables are already there; run the seed.
-- =============================================================================

-- 1) Profiles table and trigger
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
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Pro profiles and related tables
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
CREATE TRIGGER update_pro_profiles_updated_at BEFORE UPDATE ON public.pro_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
  SELECT COALESCE(AVG(rating)::numeric(3,2), 0), COUNT(*)
  FROM public.reviews WHERE pro_profile_id = p_pro_profile_id;
$$;

-- Storage buckets (ignore errors if already exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('pro-photos', 'pro-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true) ON CONFLICT (id) DO NOTHING;
