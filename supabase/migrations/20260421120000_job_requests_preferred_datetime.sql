-- Optional preferred date / time window for job requests (calendar + time-of-day)
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS preferred_date date,
  ADD COLUMN IF NOT EXISTS preferred_time_window text;

COMMENT ON COLUMN public.job_requests.preferred_date IS 'Optional preferred service date chosen by customer';
COMMENT ON COLUMN public.job_requests.preferred_time_window IS 'Optional: morning | afternoon | evening | flexible';
