-- Keep submitted insurance and licence evidence private and explicitly pending review.
-- No OCR, insurer API, RBQ API, or coverage threshold is configured yet, so the
-- platform must not mark uploaded evidence verified automatically.

DROP POLICY IF EXISTS "Anyone can view verified licenses" ON public.pro_licenses;
CREATE POLICY "Pros and moderators can view licenses"
  ON public.pro_licenses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.id = pro_profile_id AND p.user_id = auth.uid()
    )
    OR public.auth_is_platform_moderator()
  );

DROP POLICY IF EXISTS "Pros can add their licenses" ON public.pro_licenses;
CREATE POLICY "Pros can add unverified licenses"
  ON public.pro_licenses FOR INSERT TO authenticated
  WITH CHECK (
    coalesce(is_verified, false) = false
    AND verified_at IS NULL
    AND verification_data IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.id = pro_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_pro_license_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_platform_moderator() AND (
    NEW.is_verified IS DISTINCT FROM OLD.is_verified
    OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verification_data IS DISTINCT FROM OLD.verification_data
  ) THEN
    RAISE EXCEPTION 'Only platform moderators can change licence verification status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_pro_license_self_verification ON public.pro_licenses;
CREATE TRIGGER prevent_pro_license_self_verification
  BEFORE UPDATE ON public.pro_licenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pro_license_self_verification();

CREATE TABLE IF NOT EXISTS public.pro_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('insurance_certificate', 'trade_license')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'verified', 'rejected')),
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS idx_pro_verification_documents_queue
  ON public.pro_verification_documents (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_verification_documents_pro
  ON public.pro_verification_documents (pro_profile_id, created_at DESC);

ALTER TABLE public.pro_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pros can view own verification documents" ON public.pro_verification_documents;
CREATE POLICY "Pros can view own verification documents"
  ON public.pro_verification_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.id = pro_profile_id AND p.user_id = auth.uid()
    )
    OR public.auth_is_platform_moderator()
  );

DROP POLICY IF EXISTS "Pros can submit own verification documents" ON public.pro_verification_documents;
CREATE POLICY "Pros can submit own verification documents"
  ON public.pro_verification_documents FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending_review'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.id = pro_profile_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Moderators can review verification documents" ON public.pro_verification_documents;
CREATE POLICY "Moderators can review verification documents"
  ON public.pro_verification_documents FOR UPDATE TO authenticated
  USING (public.auth_is_platform_moderator())
  WITH CHECK (public.auth_is_platform_moderator());

DROP POLICY IF EXISTS "Pros can delete pending verification documents" ON public.pro_verification_documents;
CREATE POLICY "Pros can delete pending verification documents"
  ON public.pro_verification_documents FOR DELETE TO authenticated
  USING (
    status = 'pending_review'
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.id = pro_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_pro_verification_self_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.auth_is_platform_moderator() THEN
    RAISE EXCEPTION 'Only platform moderators can review verification documents';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_pro_verification_self_review ON public.pro_verification_documents;
CREATE TRIGGER prevent_pro_verification_self_review
  BEFORE UPDATE ON public.pro_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_pro_verification_self_review();
