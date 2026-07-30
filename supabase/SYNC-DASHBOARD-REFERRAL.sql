-- ============================================================================
-- Run in Supabase → SQL Editor if Dashboard shows 400s (PostgREST 42703) or
-- referral-invite Edge Function returns 500 (missing referral_invites).
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where appropriate.
-- ============================================================================

-- ----- 1) Job requests: preferred date / time (client "Make a Request") -----
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS preferred_date date,
  ADD COLUMN IF NOT EXISTS preferred_time_window text;

COMMENT ON COLUMN public.job_requests.preferred_date IS 'Optional preferred service date chosen by customer';
COMMENT ON COLUMN public.job_requests.preferred_time_window IS 'Optional: morning | afternoon | evening | flexible';

-- ----- 2) Referral invites (Edge Function referral-invite: list / send / claim) -----
CREATE TABLE IF NOT EXISTS public.referral_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invited_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  referral_code text NOT NULL UNIQUE,
  reward_code text,
  reward_days integer NOT NULL DEFAULT 14 CHECK (reward_days = 14),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'reward_claimed')),
  accepted_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_invites_no_self_unique UNIQUE (inviter_user_id, invitee_email)
);

CREATE INDEX IF NOT EXISTS referral_invites_inviter_idx
  ON public.referral_invites (inviter_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_invites_invitee_email_idx
  ON public.referral_invites (lower(invitee_email), status);

CREATE UNIQUE INDEX IF NOT EXISTS referral_invites_reward_code_key
  ON public.referral_invites (reward_code)
  WHERE reward_code IS NOT NULL;

ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referral invites" ON public.referral_invites;
CREATE POLICY "Users read own referral invites"
  ON public.referral_invites FOR SELECT
  TO authenticated
  USING (inviter_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mark_referral_invite_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code text;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  ref_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code', '');

  UPDATE public.referral_invites
  SET
    invited_user_id = NEW.id,
    status = 'completed',
    accepted_at = COALESCE(accepted_at, now()),
    updated_at = now(),
    reward_code = COALESCE(
      NULLIF(reward_code, 'freetrial'),
      'rwd_' || encode(gen_random_bytes(18), 'hex')
    )
  WHERE status = 'pending'
    AND invited_user_id IS NULL
    AND inviter_user_id <> NEW.id
    AND lower(invitee_email) = lower(NEW.email)
    AND (ref_code IS NULL OR referral_code = ref_code);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_referral_completed_insert ON auth.users;
CREATE TRIGGER on_auth_user_referral_completed_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_referral_invite_completed();

DROP TRIGGER IF EXISTS on_auth_user_referral_completed_update ON auth.users;
CREATE TRIGGER on_auth_user_referral_completed_update
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.mark_referral_invite_completed();

REVOKE ALL ON FUNCTION public.mark_referral_invite_completed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_referral_invite_completed() TO service_role;
