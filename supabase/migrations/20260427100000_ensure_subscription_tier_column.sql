-- Older databases may lack subscription_tier; admin dashboard selects it for tier controls.
alter table public.pro_profiles
  add column if not exists subscription_tier text default 'starter';
