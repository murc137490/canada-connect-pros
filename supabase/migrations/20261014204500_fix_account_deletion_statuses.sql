-- Keep the deletion workflow's persisted states compatible with its Edge Function.
ALTER TABLE public.account_deletion_requests
  DROP CONSTRAINT IF EXISTS account_deletion_requests_status_check;

ALTER TABLE public.account_deletion_requests
  ADD CONSTRAINT account_deletion_requests_status_check
  CHECK (status IN (
    'pending',
    'pending_confirmation',
    'confirmed',
    'in_progress',
    'cancelled',
    'processed',
    'completed',
    'rejected',
    'partial'
  ));
