-- Migration: Account deletion flow enhancements
-- 1. Add confirmation and scheduling columns to account_deletion_requests
ALTER TABLE public.account_deletion_requests 
ADD COLUMN IF NOT EXISTS confirmation_token text,
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS scheduled_delete_at timestamptz;

-- 2. Update foreign key on booking_claim_requests to ON DELETE CASCADE
ALTER TABLE public.booking_claim_requests
DROP CONSTRAINT IF EXISTS booking_claim_requests_pro_profile_id_fkey;

ALTER TABLE public.booking_claim_requests
ADD CONSTRAINT booking_claim_requests_pro_profile_id_fkey
FOREIGN KEY (pro_profile_id) REFERENCES public.pro_profiles(id) ON DELETE CASCADE;

-- 3. RLS policies on account_deletion_requests
DROP POLICY IF EXISTS "Moderators manage deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Moderators manage deletion requests"
ON public.account_deletion_requests
FOR ALL
TO authenticated
USING (auth_is_platform_moderator());

DROP POLICY IF EXISTS "Users update own deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Users update own deletion requests"
ON public.account_deletion_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
