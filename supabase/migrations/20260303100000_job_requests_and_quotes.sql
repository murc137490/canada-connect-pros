-- Job requests: customers post a job description; pros can send quotes.
CREATE TABLE IF NOT EXISTS public.job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  postal_code text,
  city text,
  province text,
  latitude double precision,
  longitude double precision,
  photo_urls text[] DEFAULT '{}',
  budget_range text,
  timing text,
  ai_category text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_requests_client_id ON public.job_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON public.job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_created_at ON public.job_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_requests_category ON public.job_requests(category);

COMMENT ON TABLE public.job_requests IS 'Customer job requests from Make a Request flow; pros see these and send quotes.';

-- Job quotes: pros send price, estimated time, message; customer can accept or decline.
CREATE TABLE IF NOT EXISTS public.job_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_request_id uuid NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  price_cents integer,
  estimated_time text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_request_id, pro_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_job_quotes_job_request_id ON public.job_quotes(job_request_id);
CREATE INDEX IF NOT EXISTS idx_job_quotes_pro_profile_id ON public.job_quotes(pro_profile_id);
CREATE INDEX IF NOT EXISTS idx_job_quotes_status ON public.job_quotes(status);

COMMENT ON TABLE public.job_quotes IS 'Quotes from pros on job requests; customer accepts or declines.';

-- RLS
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own job_requests"
  ON public.job_requests FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can read own job_requests"
  ON public.job_requests FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Pros can read open job_requests for matching"
  ON public.job_requests FOR SELECT
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.pro_profiles p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own job_requests (e.g. status)"
  ON public.job_requests FOR UPDATE
  USING (auth.uid() = client_id);

CREATE POLICY "Pros can insert job_quotes for their profile"
  ON public.job_quotes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid())
  );

CREATE POLICY "Pros can read own job_quotes"
  ON public.job_quotes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

CREATE POLICY "Clients can read job_quotes for their job_requests"
  ON public.job_quotes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.job_requests WHERE id = job_request_id AND client_id = auth.uid())
  );

CREATE POLICY "Pros can update own job_quotes"
  ON public.job_quotes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.pro_profiles WHERE id = pro_profile_id AND user_id = auth.uid()));

CREATE POLICY "Clients can update job_quotes for their jobs (accept/decline)"
  ON public.job_quotes FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.job_requests WHERE id = job_request_id AND client_id = auth.uid())
  );
