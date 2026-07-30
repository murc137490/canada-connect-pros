import type { ProPlanId } from "@/lib/proPlanPreview";

export type PlanTierTheme = ProPlanId;

/** CSS theme key for paid tiers (defaults to starter when unknown). */
export function planTierThemeClass(tier: ProPlanId | null | undefined): PlanTierTheme {
  if (tier === "growth" || tier === "pro") return tier;
  return "starter";
}

export const PLAN_TIER_BORDER_CLASS: Record<PlanTierTheme, string> = {
  starter: "current-plan-border current-plan-border--starter",
  growth: "current-plan-border current-plan-border--growth",
  pro: "current-plan-border current-plan-border--pro",
};

export const PLAN_TIER_NAME_CLASS: Record<PlanTierTheme, string> = {
  starter: "current-plan-name current-plan-name--starter",
  growth: "current-plan-name current-plan-name--growth",
  pro: "current-plan-name current-plan-name--pro",
};

export const PLAN_TIER_CHECK_CLASS: Record<PlanTierTheme, string> = {
  starter: "tier-check--starter",
  growth: "tier-check--growth",
  pro: "tier-check--pro",
};
