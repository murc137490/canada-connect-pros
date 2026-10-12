/** Shared money math for checkout UI and the Square payment Edge Function. */
export const BOOKING_FEE_CURRENT_BPS = 500;
export const BOOKING_FEE_FUTURE_BPS = 380;
export const BOOKING_FEE_FUTURE_START_UTC = Date.UTC(2027, 0, 1);
export const SQUARE_CANADIAN_ONLINE_RATE_BPS = 280;
export const SQUARE_CANADIAN_ONLINE_FIXED_CENTS = 30;

/** 5% through 2026-12-31 UTC; 3.8% from 2027-01-01 UTC to allow for Square processing. */
export function bookingFeeRateBps(at: Date = new Date()): number {
  return at.getTime() >= BOOKING_FEE_FUTURE_START_UTC
    ? BOOKING_FEE_FUTURE_BPS
    : BOOKING_FEE_CURRENT_BPS;
}

export function roundedRatio(value: number, numerator: bigint, denominator: bigint): number {
  return Number((BigInt(value) * numerator + denominator / 2n) / denominator);
}

export function computeExpectedBookingTotalCents(baseCents: number, at: Date = new Date()): number {
  const gstCents = roundedRatio(baseCents, 5n, 100n);
  const qstCents = roundedRatio(baseCents + gstCents, 9975n, 100000n);
  const bookingFeeCents = roundedRatio(baseCents, BigInt(bookingFeeRateBps(at)), 10000n);
  return Math.max(500, baseCents + gstCents + qstCents + bookingFeeCents);
}

export function estimateSquareOnlineProcessingCents(paymentAmountCents: number): number {
  return roundedRatio(paymentAmountCents, BigInt(SQUARE_CANADIAN_ONLINE_RATE_BPS), 10000n) + SQUARE_CANADIAN_ONLINE_FIXED_CENTS;
}

export function estimateAltShiftApplicationFeeCents(baseCents: number, paymentCents: number, at: Date = new Date()): number {
  const bookingFeeCap = roundedRatio(baseCents, BigInt(bookingFeeRateBps(at)), 10000n);
  return Math.max(0, bookingFeeCap - estimateSquareOnlineProcessingCents(paymentCents));
}
