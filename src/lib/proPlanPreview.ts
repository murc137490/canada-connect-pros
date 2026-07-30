import { supabase } from "@/integrations/supabase/client";
import { isPaidSubscriptionPlanId } from "@/lib/proTierFeatures";
import {
  computeCycleBreakdown,
  computeProrationDueDollars,
  dollarsToCents,
  inferBillingStartWhenNoSubscriptionRow,
} from "@/lib/proration";

export type ProPlanId = "starter" | "growth" | "pro";

const PLAN_IDS: ProPlanId[] = ["starter", "growth", "pro"];

export const DEFAULT_PLAN_PRICE_CENTS: Record<ProPlanId, number> = {
  starter: 2000,
  growth: 2700,
  pro: 3200,
};

function isPlanId(s: string): s is ProPlanId {
  return (PLAN_IDS as readonly string[]).includes(s);
}

function buildPriceMap(rows: { id: string; price_cents: number }[] | null): Record<ProPlanId, number> {
  const map: Record<ProPlanId, number> = { ...DEFAULT_PLAN_PRICE_CENTS };
  for (const r of rows ?? []) {
    if (r.id && isPlanId(r.id)) {
      const cents = typeof r.price_cents === "number" ? r.price_cents : Number(r.price_cents);
      if (Number.isFinite(cents) && cents >= 0) map[r.id] = Math.round(cents);
    }
  }
  return map;
}

export type PlanPreviewOk = {
  ok: true;
  charge_cents: number;
  monthly_old_cents: number;
  monthly_new_cents: number;
  /** Billed plan from `pro_subscriptions`; null before first successful checkout. */
  current_plan_id: ProPlanId | null;
  new_plan_id: ProPlanId;
  mode: "first_month" | "upgrade_prorate" | "downgrade";
  billing_period_start: string | null;
  billing_cycle_days: number;
  has_subscription_row: boolean;
  /** Starter → upgrade uses CA$20.00/mo as the “from” rate (John Pork scenario). */
  starter_rate_assumed?: boolean;
  /** End of the current billing cycle (ISO), for transparent proration display. */
  cycle_end_iso?: string;
  days_remaining_in_cycle?: number;
  /** Fraction of cycle remaining; charge ≈ (new−old)/100 × ratio when upgrading. */
  proration_ratio?: number;
  /** One-time 20% off first month after a qualifying plan cancellation (account-linked). */
  cancel_return_discount_applied?: boolean;
  /** Catalog first-month charge before return discount (cents), when discount applies. */
  charge_before_discount_cents?: number;
};

export type PlanPreviewResult = PlanPreviewOk | { ok: false; error: string };

/**
 * Offline quote when preview fails: treat as **first checkout** — full catalog month for `target` (no free Starter).
 * Used if the async preview throws (should be rare).
 */
export function assumeStarterTwentyProrationQuote(target: ProPlanId, now: Date = new Date()): PlanPreviewOk {
  const newPrice = DEFAULT_PLAN_PRICE_CENTS[target];
  const cycleDays = 30;
  const billingStart = inferBillingStartWhenNoSubscriptionRow(null, now);
  const bd = computeCycleBreakdown(billingStart, cycleDays, now);
  return {
    ok: true,
    charge_cents: newPrice,
    monthly_old_cents: 0,
    monthly_new_cents: newPrice,
    current_plan_id: null,
    new_plan_id: target,
    mode: "first_month",
    billing_period_start: billingStart.toISOString(),
    billing_cycle_days: cycleDays,
    has_subscription_row: false,
    starter_rate_assumed: false,
    ...bd,
  };
}

/**
 * Plan change preview. **Billing source of truth** is `pro_subscriptions.plan_id` when a row exists.
 * With **no** subscription row, the profile’s `subscription_tier` is ignored for pricing so Starter is not
 * “free”: first checkout charges the full catalog month for the chosen plan.
 */
export async function computePlanChangePreview(proProfileId: string, newPlanRaw: ProPlanId): Promise<PlanPreviewResult> {
  try {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { ok: false, error: "You must be signed in." };
    }

    type ProRow = {
      id: string;
      user_id: string;
      subscription_tier: string | null;
      created_at: string | null;
      cancel_return_discount_pending?: boolean | null;
      cancel_return_discount_consumed_at?: string | null;
    };
    let profile: ProRow | undefined;
    const byId = await supabase
      .from("pro_profiles")
      .select("id, user_id, subscription_tier, created_at, cancel_return_discount_pending, cancel_return_discount_consumed_at")
      .eq("id", proProfileId)
      .maybeSingle();

    if (!byId.error && byId.data) {
      profile = byId.data as ProRow;
    } else {
      const byUser = await supabase
        .from("pro_profiles")
        .select("id, user_id, subscription_tier, created_at, cancel_return_discount_pending, cancel_return_discount_consumed_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!byUser.error && byUser.data) {
        profile = byUser.data as ProRow;
      }
    }

    if (!profile) {
      return { ok: false, error: "Could not load your pro profile." };
    }
    if (profile.user_id !== user.id) {
      return { ok: false, error: "This pro profile does not belong to your account." };
    }

    let sub: {
      billing_start: string;
      billing_cycle_days: number | null;
      plan_id: string;
    } | null = null;
    const subRes = await supabase.from("pro_subscriptions").select("billing_start, billing_cycle_days, plan_id").eq("user_id", user.id).maybeSingle();
    if (!subRes.error && subRes.data) {
      sub = subRes.data as typeof sub;
    }

    const subPlanRaw = typeof sub?.plan_id === "string" ? sub.plan_id.toLowerCase() : "";
    const hasPaidPlanRow = !!(sub && isPaidSubscriptionPlanId(subPlanRaw));
    const billingPlanId: ProPlanId | null = hasPaidPlanRow ? (subPlanRaw as ProPlanId) : null;

    if (hasPaidPlanRow && billingPlanId === newPlanRaw) {
      return { ok: false, error: "You're already on this plan." };
    }

    let planRows: { id: string; price_cents: number }[] | null = null;
    const plansRes = await supabase.from("subscription_plans").select("id, price_cents").in("id", [...PLAN_IDS]);
    if (!plansRes.error && plansRes.data?.length) {
      planRows = plansRes.data;
    }

    const priceById = buildPriceMap(planRows ?? []);
    const newPrice = priceById[newPlanRaw];
    const cycleDays = sub?.billing_cycle_days ?? 30;
    const billingAnchorDate = sub ? new Date(sub.billing_start) : inferBillingStartWhenNoSubscriptionRow(profile.created_at ?? null);
    const breakdown = computeCycleBreakdown(billingAnchorDate, cycleDays);

    /** First-ever paid plan: no billable row yet (missing row or internal `hold`) — full catalog month. */
    if (!hasPaidPlanRow) {
      const returnDiscountEligible =
        profile.cancel_return_discount_pending === true && profile.cancel_return_discount_consumed_at == null;
      let chargeCents = newPrice;
      let cancelReturnDiscountApplied = false;
      if (returnDiscountEligible && newPrice > 0) {
        chargeCents = Math.round(newPrice * 0.8);
        cancelReturnDiscountApplied = true;
      }
      if (chargeCents > 0 && chargeCents < 50) {
        chargeCents = 50;
      }
      return {
        ok: true,
        charge_cents: chargeCents,
        monthly_old_cents: 0,
        monthly_new_cents: newPrice,
        current_plan_id: null,
        new_plan_id: newPlanRaw,
        mode: "first_month",
        billing_period_start: billingAnchorDate.toISOString(),
        billing_cycle_days: cycleDays,
        has_subscription_row: !!sub,
        starter_rate_assumed: false,
        cycle_end_iso: breakdown.cycle_end_iso,
        days_remaining_in_cycle: breakdown.days_remaining_in_cycle,
        proration_ratio: breakdown.proration_ratio,
        cancel_return_discount_applied: cancelReturnDiscountApplied,
        charge_before_discount_cents: cancelReturnDiscountApplied ? newPrice : undefined,
      };
    }

    const currentTier = billingPlanId!;
    const catalogOld = priceById[currentTier];
    /** Starter on file: “from” rate CA$20/mo (2000¢) for proration vs catalog. */
    const oldPrice = currentTier === "starter" ? DEFAULT_PLAN_PRICE_CENTS.starter : catalogOld;
    let billingPeriodStart: string | null = sub?.billing_start ?? null;
    let chargeCents = 0;
    let mode: PlanPreviewOk["mode"] = "downgrade";

    if (newPrice <= oldPrice) {
      chargeCents = 0;
      mode = "downgrade";
    } else {
      const { data: prAmount, error: rpcErr } = await supabase.rpc("calculate_proration", {
        old_price_cents: oldPrice,
        new_price_cents: newPrice,
        billing_start: billingAnchorDate.toISOString(),
        cycle_days: cycleDays,
      });

      let dollars: number;
      if (!rpcErr && prAmount !== null && prAmount !== undefined) {
        dollars = typeof prAmount === "number" ? prAmount : Number(prAmount);
        if (!Number.isFinite(dollars)) {
          dollars = computeProrationDueDollars(oldPrice, newPrice, billingAnchorDate, cycleDays);
        }
      } else {
        dollars = computeProrationDueDollars(oldPrice, newPrice, billingAnchorDate, cycleDays);
      }

      chargeCents = dollarsToCents(dollars);
      if (chargeCents > 0 && chargeCents < 50) {
        chargeCents = 50;
      }
      mode = "upgrade_prorate";
    }

    return {
      ok: true,
      charge_cents: chargeCents,
      monthly_old_cents: oldPrice,
      monthly_new_cents: newPrice,
      current_plan_id: currentTier,
      new_plan_id: newPlanRaw,
      mode,
      billing_period_start: billingPeriodStart,
      billing_cycle_days: cycleDays,
      has_subscription_row: true,
      starter_rate_assumed: currentTier === "starter",
      cycle_end_iso: breakdown.cycle_end_iso,
      days_remaining_in_cycle: breakdown.days_remaining_in_cycle,
      proration_ratio: breakdown.proration_ratio,
    };
  } catch (e) {
    console.warn("[computePlanChangePreview]", e);
    return assumeStarterTwentyProrationQuote(newPlanRaw);
  }
}
