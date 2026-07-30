/**
 * Stored `billing_cycle_days === 30` means **one calendar month** (same UTC calendar day next month),
 * matching PostgreSQL `billing_start + interval '1 month'`, not 30×24h.
 */
export const CALENDAR_MONTH_CYCLE_DAYS = 30;

export function computeBillingCycleEnd(billingStart: Date, cycleDays: number): Date {
  if (cycleDays === CALENDAR_MONTH_CYCLE_DAYS) {
    const d = new Date(billingStart.getTime());
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  return new Date(billingStart.getTime() + cycleDays * 86400000);
}

/**
 * Mirrors `public.calculate_proration` in Supabase (returns **dollars**, 2 decimal places).
 * Used when the RPC is unavailable and for inferred billing when `pro_subscriptions` has no row.
 */
export function computeProrationDueDollars(
  oldPriceCents: number,
  newPriceCents: number,
  billingStart: Date,
  cycleDays: number,
  now: Date = new Date()
): number {
  if (newPriceCents <= oldPriceCents) return 0;

  const cycleEnd = computeBillingCycleEnd(billingStart, cycleDays);
  const totalSeconds = Math.max((cycleEnd.getTime() - billingStart.getTime()) / 1000, 1);
  const remainingSeconds = (cycleEnd.getTime() - now.getTime()) / 1000;
  const diffCents = newPriceCents - oldPriceCents;

  if (remainingSeconds <= 0) {
    return Math.round((diffCents / 100) * 100) / 100;
  }

  const ratio = Math.min(Math.max(remainingSeconds, 0), totalSeconds) / totalSeconds;
  const proratedCents = diffCents * ratio;
  return Math.round((proratedCents / 100) * 100) / 100;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** UTC midnight on the 1st of the month (matches Supabase `now()` / timestamptz math). */
export function startOfUtcMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * When there is no `pro_subscriptions` row, infer cycle start as the later of:
 * - UTC start of the current calendar month, or
 * - the UTC calendar day the pro profile was created.
 * Example: today 2026-04-20, subscribed 2026-04-01 → billing_start 2026-04-01 UTC, prorated upgrade vs Growth.
 */
export function inferBillingStartWhenNoSubscriptionRow(profileCreatedAtIso: string | null | undefined, now: Date = new Date()): Date {
  const monthStart = startOfUtcMonth(now);
  if (!profileCreatedAtIso) return monthStart;
  const created = new Date(profileCreatedAtIso);
  if (Number.isNaN(created.getTime())) return monthStart;
  const createdDayUtc = new Date(Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate(), 0, 0, 0, 0));
  return createdDayUtc > monthStart ? createdDayUtc : monthStart;
}

/** Aligns with `public.calculate_proration`: ratio = capped remaining seconds / full cycle seconds. */
export type CycleBreakdown = {
  cycle_end_iso: string;
  /** Whole days left in the cycle (display; uses ceiling of remaining ms / 1 day). */
  days_remaining_in_cycle: number;
  /** 0–1 fraction of the billing cycle still remaining (matches proration ratio). */
  proration_ratio: number;
};

export function computeCycleBreakdown(billingStart: Date, cycleDays: number, now: Date = new Date()): CycleBreakdown {
  const cycleEnd = computeBillingCycleEnd(billingStart, cycleDays);
  const totalMs = Math.max(cycleEnd.getTime() - billingStart.getTime(), 1);
  const remainingMs = cycleEnd.getTime() - now.getTime();
  const cappedRemainingMs = Math.min(Math.max(remainingMs, 0), totalMs);
  const ratio = cappedRemainingMs / totalMs;
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / 86400000));
  return {
    cycle_end_iso: cycleEnd.toISOString(),
    days_remaining_in_cycle: daysRemaining,
    proration_ratio: ratio,
  };
}

/**
 * Next moment the customer is billed / period rolls: active trial end first, otherwise the next
 * cycle boundary after `now`. When a trial already ended, billing periods are anchored from
 * `trial_ends_at` so long trials do not skew the first paid renewal.
 */
export function computeNextBillingMomentIso(opts: {
  billingStart: string | null | undefined;
  cycleDays: number;
  trialEndsAt: string | null | undefined;
  now?: Date;
}): string | null {
  const now = opts.now ?? new Date();
  const trialEnd = opts.trialEndsAt ? new Date(opts.trialEndsAt) : null;
  if (trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd.getTime() > now.getTime()) {
    return trialEnd.toISOString();
  }

  const cycleDays = Number.isFinite(opts.cycleDays) ? opts.cycleDays : CALENDAR_MONTH_CYCLE_DAYS;
  const billingStart = opts.billingStart ? new Date(opts.billingStart) : null;

  let anchor: Date | null = null;
  if (trialEnd && !Number.isNaN(trialEnd.getTime()) && trialEnd.getTime() <= now.getTime()) {
    anchor = trialEnd;
  } else if (billingStart && !Number.isNaN(billingStart.getTime())) {
    anchor = billingStart;
  }

  if (!anchor) return null;

  let periodEnd = computeBillingCycleEnd(anchor, cycleDays);
  while (periodEnd.getTime() <= now.getTime()) {
    periodEnd = computeBillingCycleEnd(periodEnd, cycleDays);
  }
  return periodEnd.toISOString();
}
