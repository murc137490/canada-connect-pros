-- =============================================================================
-- Login with email OR full name. Name uniqueness check for signup.
-- Run once in Supabase SQL Editor. Replaces username-based flow with name-based.
-- =============================================================================

-- 1. Ensure email_language exists on profiles (if not from ADD-EMAIL-LANGUAGE)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_language text DEFAULT 'en' CHECK (email_language IN ('en', 'fr'));

-- 2. Trigger: set full_name and email_language (no username)
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

-- Normalize name for comparison: trim, lowercase, collapse spaces to one
CREATE OR REPLACE FUNCTION public.normalize_name(n text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(trim(regexp_replace(coalesce(n, ''), '\s+', ' ', 'g')));
$$;

-- 3. Check if a name is taken by another user (different email). Use this before signUp so we don't show "name taken" when the only match is the same email (that user should get "email in use" from signUp).
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

-- Legacy: is_name_taken (any user with that name) – prefer is_name_taken_by_other for signup
CREATE OR REPLACE FUNCTION public.is_name_taken(full_name text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT exists (
    SELECT 1 FROM public.profiles p
    WHERE p.full_name IS NOT NULL
      AND public.normalize_name(p.full_name) = public.normalize_name(full_name)
  );
$$;

-- 4. Resolve name to email for sign-in (match on normalized full_name)
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
