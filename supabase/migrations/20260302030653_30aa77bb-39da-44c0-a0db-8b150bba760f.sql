
-- Pro profiles (extended info for service providers)
CREATE TABLE public.pro_profiles (
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

CREATE POLICY "Anyone can view pro profiles" ON public.pro_profiles FOR SELECT USING (true);
CREATE POLICY "Pros can insert their own profile" ON public.pro_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Pros can update their own profile" ON public.pro_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Pros can delete their own profile" ON public.pro_profiles FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pro_profiles_updated_at BEFORE UPDATE ON public.pro_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pro services (which services each pro offers)
CREATE TABLE public.pro_services (
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

CREATE POLICY "Anyone can view pro services" ON public.pro_services FOR SELECT USING (true);
CREATE POLICY "Pros can manage their services" ON public.pro_services FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their services" ON public.pro_services FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their services" ON public.pro_services FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

-- Pro photos
CREATE TABLE public.pro_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pro photos" ON public.pro_photos FOR SELECT USING (true);
CREATE POLICY "Pros can manage their photos" ON public.pro_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their photos" ON public.pro_photos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their photos" ON public.pro_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

-- Reviews
CREATE TABLE public.reviews (
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

CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update their reviews" ON public.reviews FOR UPDATE USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete their reviews" ON public.reviews FOR DELETE USING (auth.uid() = reviewer_id);

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Review photos
CREATE TABLE public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review photos" ON public.review_photos FOR SELECT USING (true);
CREATE POLICY "Reviewers can add photos" ON public.review_photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.reviews WHERE id = review_id AND reviewer_id = auth.uid()));
CREATE POLICY "Reviewers can delete their photos" ON public.review_photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.reviews WHERE id = review_id AND reviewer_id = auth.uid()));

-- Review responses (from pros)
CREATE TABLE public.review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE UNIQUE,
  pro_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view review responses" ON public.review_responses FOR SELECT USING (true);
CREATE POLICY "Pros can respond to their reviews" ON public.review_responses FOR INSERT
  WITH CHECK (auth.uid() = pro_user_id AND EXISTS (
    SELECT 1 FROM public.reviews r
    JOIN public.pro_profiles pp ON r.pro_profile_id = pp.id
    WHERE r.id = review_id AND pp.user_id = auth.uid()
  ));
CREATE POLICY "Pros can update their responses" ON public.review_responses FOR UPDATE
  USING (auth.uid() = pro_user_id);
CREATE POLICY "Pros can delete their responses" ON public.review_responses FOR DELETE
  USING (auth.uid() = pro_user_id);

CREATE TRIGGER update_review_responses_updated_at BEFORE UPDATE ON public.review_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pro licenses (RBQ and other licenses)
CREATE TABLE public.pro_licenses (
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

CREATE POLICY "Anyone can view verified licenses" ON public.pro_licenses FOR SELECT USING (true);
CREATE POLICY "Pros can add their licenses" ON public.pro_licenses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can update their licenses" ON public.pro_licenses FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));
CREATE POLICY "Pros can delete their licenses" ON public.pro_licenses FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

-- Aggregate view for pro ratings
CREATE OR REPLACE FUNCTION public.get_pro_avg_rating(p_pro_profile_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(AVG(rating)::numeric(3,2), 0), COUNT(*)
  FROM public.reviews
  WHERE pro_profile_id = p_pro_profile_id;
$$;

-- Storage bucket for pro and review photos
INSERT INTO storage.buckets (id, name, public) VALUES ('pro-photos', 'pro-photos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true);

CREATE POLICY "Anyone can view pro photos storage" ON storage.objects FOR SELECT USING (bucket_id = 'pro-photos');
CREATE POLICY "Authenticated users can upload pro photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pro-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their pro photos" ON storage.objects FOR DELETE USING (bucket_id = 'pro-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view review photos storage" ON storage.objects FOR SELECT USING (bucket_id = 'review-photos');
CREATE POLICY "Authenticated users can upload review photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'review-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their review photos" ON storage.objects FOR DELETE USING (bucket_id = 'review-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
