-- =============================================================================
-- Run this ONCE in Supabase SQL Editor.
-- Replaces your Query 3 and Query 4. Keeps: email_language, name login, handle_new_user, get_pro_and_user, is_name_taken_by_other.
-- =============================================================================

-- 1) Email language columns (for signup + pro emails)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));

ALTER TABLE public.pro_profiles
  ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));

-- 2) Name normalization and name-based login
CREATE OR REPLACE FUNCTION public.normalize_name(n text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g')));
$$;

CREATE OR REPLACE FUNCTION public.is_name_taken(full_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT exists (
    SELECT 1 FROM public.profiles p
    WHERE p.full_name IS NOT NULL
      AND public.normalize_name(p.full_name) = public.normalize_name(full_name)
  );
$$;

-- Name taken by *another* user (different email) — used at signup to show "name taken" vs "email in use"
CREATE OR REPLACE FUNCTION public.is_name_taken_by_other(full_name text, exclude_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT exists (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.full_name IS NOT NULL
      AND public.normalize_name(p.full_name) = public.normalize_name(full_name)
      AND lower(trim(u.email)) != lower(trim(exclude_email))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_email_for_name(full_name text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.email::text
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE p.full_name IS NOT NULL
    AND public.normalize_name(p.full_name) = public.normalize_name(full_name)
  LIMIT 1;
$$;

-- 3) Trigger: set full_name (trimmed) and email_language on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email_language)
  VALUES (
    NEW.id,
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en')
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  UPDATE public.profiles
  SET
    full_name = NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    email_language = COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'email_language'), ''), 'en')
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- 4) RPC for Edge Functions: get pro email and language
CREATE OR REPLACE FUNCTION public.get_pro_and_user(pro_user_id uuid)
RETURNS TABLE(user_id uuid, email text, business_name text, email_language text) AS $$
  SELECT u.id, u.email::text, pp.business_name,
         COALESCE(NULLIF(pp.email_language, ''), p.email_language, 'en')::text
  FROM auth.users u
  JOIN public.pro_profiles pp ON pp.user_id = u.id
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = pro_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
