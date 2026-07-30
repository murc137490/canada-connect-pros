-- Personal trial links are admin-copyable, one-time-use links with no expiry date.
-- Existing hash-only active rows cannot be reconstructed into URLs, so cleanup
-- removes them and the admin generator recreates up to five copyable links.

alter table public.trial_tokens
  add column if not exists token_value text;

create unique index if not exists trial_tokens_token_value_idx
  on public.trial_tokens (token_value)
  where token_value is not null;

alter table public.trial_tokens
  alter column expires_at drop not null;

create or replace function public.cleanup_trial_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.trial_tokens
  where used_at is not null
     or token_value is null;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_trial_tokens() from public;
grant execute on function public.cleanup_trial_tokens() to service_role;
