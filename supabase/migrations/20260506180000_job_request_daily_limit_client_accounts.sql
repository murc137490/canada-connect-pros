-- Non–pro accounts: at most 2 job_requests per calendar day (UTC). Pro accounts (row in pro_profiles) exempt.
CREATE OR REPLACE FUNCTION public.enforce_job_request_daily_limit_client_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pro_profiles p WHERE p.user_id = NEW.client_id) THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*)::integer
    FROM public.job_requests j
    WHERE j.client_id = NEW.client_id
      AND (j.created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
  ) >= 2 THEN
    RAISE EXCEPTION 'JOB_REQUEST_DAILY_LIMIT' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_job_request_daily_limit_client_accounts ON public.job_requests;

CREATE TRIGGER enforce_job_request_daily_limit_client_accounts
  BEFORE INSERT ON public.job_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_request_daily_limit_client_accounts();

COMMENT ON FUNCTION public.enforce_job_request_daily_limit_client_accounts() IS
  'Blocks more than 2 inserts into job_requests per client_id per UTC day unless the user has a pro_profiles row.';
