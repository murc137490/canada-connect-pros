-- Run once in Supabase SQL Editor.
-- 1) Table to count profile views (clicks) per pro.
CREATE TABLE IF NOT EXISTS public.pro_profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_profile_views_pro ON public.pro_profile_views(pro_profile_id);
CREATE INDEX IF NOT EXISTS idx_pro_profile_views_at ON public.pro_profile_views(viewed_at);

ALTER TABLE public.pro_profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert profile view" ON public.pro_profile_views;
CREATE POLICY "Anyone can insert profile view" ON public.pro_profile_views FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Pros can read own views" ON public.pro_profile_views;
CREATE POLICY "Pros can read own views" ON public.pro_profile_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

-- 2) RPC: get pro's rank (1-based) and total pros in same category for "top X%" display.
CREATE OR REPLACE FUNCTION public.get_pro_rank_in_category(p_pro_profile_id uuid)
RETURNS TABLE(rank bigint, total bigint, category_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cat AS (
    SELECT ps.category_slug
    FROM public.pro_services ps
    WHERE ps.pro_profile_id = p_pro_profile_id
    LIMIT 1
  ),
  ranked AS (
    SELECT pp.id,
           ROW_NUMBER() OVER (ORDER BY (SELECT COALESCE(AVG(r.rating), 0) FROM public.reviews r WHERE r.pro_profile_id = pp.id) DESC NULLS LAST, pp.created_at) AS rn,
           (SELECT COUNT(*) FROM public.pro_profiles pp2
            WHERE pp2.is_verified = true
              AND EXISTS (SELECT 1 FROM public.pro_services ps2 WHERE ps2.pro_profile_id = pp2.id AND ps2.category_slug = (SELECT category_slug FROM cat))))
    FROM public.pro_profiles pp
    JOIN public.pro_services ps ON ps.pro_profile_id = pp.id
    WHERE pp.is_verified = true AND ps.category_slug = (SELECT category_slug FROM cat)
  )
  SELECT r.rn::bigint AS rank, (SELECT COUNT(*)::bigint FROM ranked) AS total, (SELECT category_slug FROM cat) AS category_slug
  FROM ranked r
  WHERE r.id = p_pro_profile_id;
$$;
