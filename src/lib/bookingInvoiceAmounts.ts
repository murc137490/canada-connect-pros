import { PLATFORM_FEE_RATE, SQUARE_CONNECT_APP_FEE_RATE } from "@/config/legalConfig";

/** Quebec: GST 5% on taxable; QST 9.975% on (taxable + GST). Matches BookingCheckout. */
export const BOOKING_INVOICE_GST_RATE = 0.05;
export const BOOKING_INVOICE_QST_RATE = 0.09975;

/**
 * Customer-facing Première Services platform fee on the service subtotal (5%).
 * Do not describe this as "Square's card rate." Internal Connect app_fee is separate.
 */
export const BOOKING_INVOICE_PROCESSING_FEE_RATE = PLATFORM_FEE_RATE;

/** Square Connect `app_fee_money` rate in code — implementation detail, not a public Square list price. */
export const BOOKING_SQUARE_APP_FEE_RATE = SQUARE_CONNECT_APP_FEE_RATE;

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
export function computeBookingInvoiceFromBaseCents(baseAmountCents: number): BookingInvoiceComputed {
  const sub = Math.max(0, baseAmountCents / 100);
  const gstAmt = sub * BOOKING_INVOICE_GST_RATE;
  const qstAmt = (sub + gstAmt) * BOOKING_INVOICE_QST_RATE;
  const platformFee = sub * BOOKING_INVOICE_PROCESSING_FEE_RATE;
  const total = sub + gstAmt + qstAmt + platformFee;
  const cents = Math.max(500, Math.round(total * 100));
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
