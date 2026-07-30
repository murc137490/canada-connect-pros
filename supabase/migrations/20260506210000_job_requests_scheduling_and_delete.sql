-- Structured scheduling (mirrors Make a Request) for reliable edit in dashboard; legacy rows keep preferred_time_window only.
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS scheduling_mode text,
  ADD COLUMN IF NOT EXISTS time_window_code text,
  ADD COLUMN IF NOT EXISTS range_start_date date,
  ADD COLUMN IF NOT EXISTS range_end_date date,
  ADD COLUMN IF NOT EXISTS exact_time text,
  ADD COLUMN IF NOT EXISTS window_time_start text,
  ADD COLUMN IF NOT EXISTS window_time_end text;

ALTER TABLE public.job_requests DROP CONSTRAINT IF EXISTS job_requests_scheduling_mode_check;
ALTER TABLE public.job_requests
  ADD CONSTRAINT job_requests_scheduling_mode_check
  CHECK (scheduling_mode IS NULL OR scheduling_mode IN ('range', 'specific_day', 'exact'));

COMMENT ON COLUMN public.job_requests.scheduling_mode IS 'range | specific_day | exact – from Make a Request';
COMMENT ON COLUMN public.job_requests.time_window_code IS 'For specific_day: empty or morning | afternoon | evening | flexible';

DROP POLICY IF EXISTS "Users can delete own job_requests" ON public.job_requests;
CREATE POLICY "Users can delete own job_requests"
  ON public.job_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = client_id);
