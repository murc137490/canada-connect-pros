-- Quote proposed service date (shown next to price for clients).
alter table public.job_quotes
  add column if not exists proposed_service_date date;

comment on column public.job_quotes.proposed_service_date is
  'Day the pro proposes to perform the service (shown next to quote price).';
