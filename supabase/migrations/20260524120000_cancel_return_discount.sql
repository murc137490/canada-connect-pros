-- One-time 20% off next plan purchase after first paid-plan cancellation (account-linked, not a promo code).
alter table public.pro_profiles
  add column if not exists cancel_return_discount_pending boolean not null default false,
  add column if not exists cancel_return_discount_consumed_at timestamptz null;

comment on column public.pro_profiles.cancel_return_discount_pending is
  'True after first qualifying cancel (paid tier -> hold) while the 20% return discount has not been used on checkout.';
comment on column public.pro_profiles.cancel_return_discount_consumed_at is
  'Set when the return discount is used or forfeited on plan checkout; prevents granting again on later cancels.';
