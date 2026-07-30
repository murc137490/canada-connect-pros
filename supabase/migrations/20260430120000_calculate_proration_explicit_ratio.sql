-- Match client `computeProrationDueDollars`: ratio uses remaining time clamped to [0, total_cycle_seconds].

create or replace function public.calculate_proration(
  old_price_cents integer,
  new_price_cents integer,
  billing_start timestamp with time zone,
  cycle_days integer
)
returns numeric
language plpgsql
stable
as $$
declare
  now_ts timestamptz := now();
  cycle_end timestamptz := billing_start + (cycle_days || ' days')::interval;
  total_seconds numeric;
  remaining_seconds numeric;
  price_diff_cents numeric;
  prorated_cents numeric;
  ratio numeric;
begin
  if coalesce(new_price_cents, 0) <= coalesce(old_price_cents, 0) then
    return 0::numeric;
  end if;

  total_seconds := greatest(extract(epoch from (cycle_end - billing_start)), 1);
  remaining_seconds := extract(epoch from (cycle_end - now_ts));

  price_diff_cents := (new_price_cents - old_price_cents)::numeric;

  if remaining_seconds <= 0 then
    return round(price_diff_cents / 100.0, 2);
  end if;

  ratio := least(greatest(remaining_seconds, 0::numeric), total_seconds) / total_seconds;
  prorated_cents := price_diff_cents * ratio;
  return round(prorated_cents / 100.0, 2);
end;
$$;

grant execute on function public.calculate_proration(integer, integer, timestamp with time zone, integer) to anon, authenticated, service_role;
