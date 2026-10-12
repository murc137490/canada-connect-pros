/** Booking Credit calculations use integer CAD cents: one credit covers each $100 slice. */
export const BOOKING_CREDIT_COVERAGE_CENTS = 10_000;

export function bookingCreditsRequired(eligibleBookingValueCents: number): number {
  if (!Number.isSafeInteger(eligibleBookingValueCents) || eligibleBookingValueCents < 0) {
    throw new RangeError("Eligible booking value must be a non-negative integer number of cents.");
  }
  return eligibleBookingValueCents === 0
    ? 0
    : Number((BigInt(eligibleBookingValueCents) + BigInt(BOOKING_CREDIT_COVERAGE_CENTS - 1)) / BigInt(BOOKING_CREDIT_COVERAGE_CENTS));
}

export function bookingCreditsInsufficientMessage(error: unknown, locale: string): string | null {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");
  const match = message.match(/booking_credits_insufficient:\s*required\s+(\d+)\s+available\s+(\d+)/i);
  if (!match) return null;
  const required = Number(match[1]);
  const available = Number(match[2]);
  return locale === "fr"
    ? `Cette réservation nécessite ${required} crédits de réservation. Vous en avez ${available} disponibles. Changez de forfait ou communiquez avec le soutien AltShift pour continuer.`
    : `This booking requires ${required} Booking Credits. You have ${available} available. Change your plan or contact AltShift support to continue.`;
}

export const BOOKING_CREDIT_PLAN_DEFAULTS = {
  starter: { priceCents: 2900, monthlyCredits: 5 },
  growth: { priceCents: 3900, monthlyCredits: 10 },
  pro: { priceCents: 4900, monthlyCredits: 18 },
} as const;
