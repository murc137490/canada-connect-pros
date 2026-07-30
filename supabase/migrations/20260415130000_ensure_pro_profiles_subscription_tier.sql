-- Projects that never ran 20260303110000 or 20260427100000: admin tier updates + app reads fail without this column.

alter table public.pro_profiles
  add column if not exists subscription_tier text default 'starter';

comment on column public.pro_profiles.subscription_tier is 'Plan tier: starter, growth, or pro. Used for feature gating and admin controls.';
