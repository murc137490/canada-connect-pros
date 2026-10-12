-- The platform no longer limits opportunities, requests, or quotes by subscription tier.
-- Keep pro_client_request_limit() as a temporary compatibility helper returning NULL for
-- the recurring-booking generator, but remove the obsolete trigger/RPC code.
drop trigger if exists trg_bookings_enforce_client_request_limit on public.bookings;
drop trigger if exists trg_job_quotes_enforce_client_request_limit on public.job_quotes;
drop function if exists public.bookings_enforce_client_request_limit();
drop function if exists public.job_quotes_enforce_client_request_limit();
revoke all on function public.booking_request_rank_in_month(uuid) from public, anon, authenticated;
drop function if exists public.booking_request_rank_in_month(uuid);

comment on function public.booking_series_generate_due(boolean, integer) is
  'Creates due recurring bookings without subscription-based request caps. Accepted bookings reserve Booking Credits atomically via the bookings trigger.';
