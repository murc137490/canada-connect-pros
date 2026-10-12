import {
  bookingFeeRateBps,
  estimateAltShiftApplicationFeeCents as estimateSharedAltShiftApplicationFeeCents,
  estimateSquareOnlineProcessingCents as estimateSharedSquareOnlineProcessingCents,
} from "../../supabase/functions/_shared/bookingPaymentMath";

/** Quebec: GST 5% on taxable; QST 9.975% on (taxable + GST). Matches BookingCheckout. */
export const BOOKING_INVOICE_GST_RATE = 0.05;
export const BOOKING_INVOICE_QST_RATE = 0.09975;

/**
 * Current customer-facing booking-fee rate on the service subtotal.
 * It changes from 5% to 3.8% on 2027-01-01 UTC.
 */
export const BOOKING_INVOICE_PROCESSING_FEE_RATE = bookingFeeRateBps() / 10000;

/**
 * Estimate Square's standard Canadian online processing cost before settlement (2.8% + $0.30).
 * Square deducts this before its application fee. The estimate is used only to cap
 * AltShift's application fee; Square's actual card-specific fee may differ.
 */
export function estimateSquareOnlineProcessingCents(paymentAmountCents: number): number {
  if (!Number.isSafeInteger(paymentAmountCents) || paymentAmountCents < 0) {
    throw new RangeError("Payment amount must be a non-negative integer number of cents.");
  }
  return estimateSharedSquareOnlineProcessingCents(paymentAmountCents);
}

/** Amount left for AltShift after estimated processing, capped by the scheduled booking fee. */
export function estimateAltShiftApplicationFeeCents(baseAmountCents: number, paymentAmountCents: number, at: Date = new Date()): number {
  if (!Number.isSafeInteger(baseAmountCents) || baseAmountCents < 0) {
    throw new RangeError("Service subtotal must be a non-negative integer number of cents.");
  }
  return estimateSharedAltShiftApplicationFeeCents(baseAmountCents, paymentAmountCents, at);
}

export type BookingInvoiceComputed = {
  subtotal: number;
  gst: number;
  qst: number;
  processingFee: number;
  /** Alias: platform fee dollars (same as processingFee). */
  platformFee: number;
  totalCents: number;
  totalDollars: string;
};

/** @param baseAmountCents — service subtotal in cents (before tax & platform fee). */
export function computeBookingInvoiceFromBaseCents(baseAmountCents: number, at: Date = new Date()): BookingInvoiceComputed {
  if (!Number.isSafeInteger(baseAmountCents)) throw new RangeError("Service subtotal must be an integer number of cents.");
  const subCents = Math.max(0, baseAmountCents);
  const roundRatio = (cents: number, numerator: bigint, denominator: bigint) =>
    Number((BigInt(cents) * numerator + denominator / 2n) / denominator);
  const gstCents = roundRatio(subCents, 5n, 100n);
  const qstCents = roundRatio(subCents + gstCents, 9975n, 100000n);
  const platformFeeCents = roundRatio(subCents, BigInt(bookingFeeRateBps(at)), 10000n);
  const cents = Math.max(500, subCents + gstCents + qstCents + platformFeeCents);
  const sub = subCents / 100;
  const gstAmt = gstCents / 100;
  const qstAmt = qstCents / 100;
  const platformFee = platformFeeCents / 100;
  return {
    subtotal: sub,
    gst: gstAmt,
    qst: qstAmt,
    processingFee: platformFee,
    platformFee,
    totalCents: cents,
    totalDollars: (cents / 100).toFixed(2),
  };
}
