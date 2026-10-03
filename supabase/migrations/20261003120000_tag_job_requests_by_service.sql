-- Preserve the selected catalog service on quote requests so professionals
-- only see matching custom jobs in the service-specific jobs view.
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS category_slug text,
  ADD COLUMN IF NOT EXISTS service_slug text;

CREATE INDEX IF NOT EXISTS idx_job_requests_open_service_recent
  ON public.job_requests (service_slug, created_at DESC)
  WHERE status = 'open';
