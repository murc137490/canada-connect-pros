-- Bring current paid cycles up to the new plan allowance without resetting or removing credits.
with anchors as (
  select pp.id as pro_profile_id,
         ps.plan_id,
         greatest(1, coalesce(ps.billing_cycle_days, 30)) as cycle_days,
         coalesce(ps.billing_start, date_trunc('month', now())) as anchor_at,
         sp.monthly_booking_credits as target_credits
  from public.pro_subscriptions ps
  join public.pro_profiles pp on pp.user_id = ps.user_id
  join public.subscription_plans sp on sp.id = ps.plan_id
  where ps.plan_id in ('starter', 'growth', 'pro')
    and sp.monthly_booking_credits > 0
), cycles as (
  select a.*,
         a.anchor_at + floor(extract(epoch from (now() - a.anchor_at)) / (86400 * a.cycle_days))::integer
           * a.cycle_days * interval '1 day' as cycle_start,
         a.anchor_at + (floor(extract(epoch from (now() - a.anchor_at)) / (86400 * a.cycle_days))::integer + 1)
           * a.cycle_days * interval '1 day' as cycle_end
  from anchors a
), due as (
  select c.pro_profile_id, c.plan_id, c.cycle_start, c.cycle_end, c.target_credits,
         greatest(0, c.target_credits - coalesce(sum(g.granted), 0))::integer as top_up
  from cycles c
  left join public.booking_credit_grants g
    on g.pro_profile_id = c.pro_profile_id
   and g.grant_type = 'subscription'
   and g.created_at >= c.cycle_start
   and g.created_at < c.cycle_end
   and (g.expires_at is null or g.expires_at > now())
  group by c.pro_profile_id, c.plan_id, c.cycle_start, c.cycle_end, c.target_credits
  having c.target_credits > coalesce(sum(g.granted), 0)
), inserted as (
  insert into public.booking_credit_grants(
    pro_profile_id, grant_type, granted, remaining, expires_at, source_reference, metadata
  )
  select d.pro_profile_id, 'subscription', d.top_up, d.top_up, d.cycle_end,
         'plan-allowance-adjustment:' || d.pro_profile_id::text || ':' || d.cycle_start::text,
         jsonb_build_object('plan_id', d.plan_id, 'cycle_start', d.cycle_start,
                            'source', 'monthly_entitlement_increase')
  from due d
  where d.top_up > 0
  on conflict (grant_type, source_reference) do nothing
  returning id, pro_profile_id, granted, source_reference, metadata
)
insert into public.booking_credit_ledger(
  pro_profile_id, grant_id, transaction_type, credit_amount, source_reference, reason, metadata
)
select i.pro_profile_id, i.id, 'subscription_credit_grant', i.granted, i.source_reference,
       'Current cycle top-up to the updated monthly Booking Credit allowance', i.metadata
from inserted i;
