-- Increase monthly Booking Credit entitlements without changing plan tools or prices.
-- Existing paid cycle grants remain intact; the new allowance takes effect on the next grant.
update public.subscription_plans
set monthly_booking_credits = case id
  when 'starter' then 10
  when 'growth' then 17
  when 'pro' then 22
  else monthly_booking_credits
end
where id in ('starter', 'growth', 'pro');
