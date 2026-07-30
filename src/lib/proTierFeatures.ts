import type { ProPlanId } from "@/lib/proPlanPreview";

/** Billable catalog tiers (shown on pricing / checkout). "hold" is internal only. */
export function isPaidSubscriptionPlanId(id: string | null | undefined): id is ProPlanId {
  const s = (id ?? "").toLowerCase().trim();
  return s === "starter" || s === "growth" || s === "pro";
}

/** Normalize legacy DB values to a paid tier for comparisons (never returns "hold"). */
export function normalizeProTier(raw: string | null | undefined): ProPlanId {
  const s = (raw ?? "starter").toLowerCase().trim();
  if (s === "growth" || s === "pro") return s;
  return "starter";
}

/**
 * Tier used for Growth/Pro feature gates. `null` = internal "hold" or no billable plan —
 * the pro does not get paid-tier tools until they subscribe to starter, growth, or pro.
 */
export function effectiveProTier(
  profileTier: string | null | undefined,
  subscriptionPlanId: string | null | undefined,
): ProPlanId | null {
  const sub = typeof subscriptionPlanId === "string" ? subscriptionPlanId.trim().toLowerCase() : "";
  if (sub === "hold") return null;
  if (isPaidSubscriptionPlanId(sub)) return sub;
  const p = typeof profileTier === "string" ? profileTier.trim().toLowerCase() : "";
  if (p === "hold") return null;
  if (isPaidSubscriptionPlanId(p)) return p;
  return null;
}

/** Admin-only label key for internal hold state (translate in UI). */
export function isHoldSubscriptionPlanId(id: string | null | undefined): boolean {
  return (id ?? "").toLowerCase().trim() === "hold";
}

/** Growth & Pro: multi-month schedule editor + full booking calendar in dashboard. */
export function hasFullScheduleCalendarAccess(tier: ProPlanId | null | undefined): boolean {
  if (!tier) return false;
  return tier === "growth" || tier === "pro";
}

/** Monthly client request access limit. Pro has no UI access cap. Hold = no access (0). */
export function clientRequestLimitForTier(tier: ProPlanId | null | undefined): number | null {
  if (!tier) return 0;
  if (tier === "starter") return 20;
  if (tier === "growth") return 50;
  return null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar YYYY-MM-DD for `d` (no UTC shift). */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Last day in the rolling Starter window: today (local) + `days` calendar days.
 * E.g. Apr 24 + 30 days → May 24; Apr 25 is outside the window.
 */
export function scheduleRollingWindowEndDateStr(daysFromToday: number = 30): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + daysFromToday);
  return localYmd(t);
}

/** Growth & Pro: featured public profile (banner, rich header, animations, spotlight booking CTA). */
export function hasFeaturedPublicProfileLook(tier: ProPlanId | null | undefined): boolean {
  if (!tier) return false;
  return tier === "growth" || tier === "pro";
}

/** Pro only: SMS booking confirmations + automated reminder pipeline (Twilio). */
export function hasSmsBookingAutomation(tier: ProPlanId | null | undefined): boolean {
  return tier === "pro";
}

/** Pro only: booking-flow AI assistant (service context via ai-chat-hf). */
export function hasBookingAssistantAI(tier: ProPlanId | null | undefined): boolean {
  return tier === "pro";
}

/** Growth & Pro: auto-reply to new bookings, renewal cadence on services, service bundles. */
export function hasGrowthServiceExtras(tier: ProPlanId | null | undefined): boolean {
  if (!tier) return false;
  return tier === "growth" || tier === "pro";
}
