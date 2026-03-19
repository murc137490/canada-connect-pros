-- =============================================================================
-- Email language preference (run once in Supabase SQL Editor)
-- Run after RUN-THIS-ONCE-CREATE-TABLES.sql. Adds columns and RPC for EN/FR emails.
-- =============================================================================

-- 1. Store preferred email language for all users (used at signup; auth emails / app emails)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));

-- 2. Optional override on pro_profiles; if null, get_pro_and_user uses profiles.email_language (set at signup)
ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));

-- 3. When a new user signs up, copy email_language from signup metadata into profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_language)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en')
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  UPDATE public.profiles
  SET email_language = COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en')
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- 4. RPC for Edge Function: get pro's email and language (preference from signup via profiles; pro_profiles optional override)
CREATE OR REPLACE FUNCTION public.get_pro_and_user(pro_user_id uuid)
RETURNS TABLE(user_id uuid, email text, business_name text, email_language text) AS $$
  SELECT u.id, u.email::text, pp.business_name,
         COALESCE(NULLIF(pp.email_language, ''), p.email_language, 'en')::text
  FROM auth.users u
  JOIN public.pro_profiles pp ON pp.user_id = u.id
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = pro_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
