/** Quebec: GST 5% on taxable; QST 9.975% on (taxable + GST). Matches BookingCheckout. */
export const BOOKING_INVOICE_GST_RATE = 0.05;
export const BOOKING_INVOICE_QST_RATE = 0.09975;
/**
 * Single customer-facing fee line on the service subtotal (~5% total):
 * ~2.9% covers card processing (Square), ~2.1% is the platform share taken via Square Connect `app_fee_money`.
 * Not additive on top of Square’s merchant pricing — one 5% bucket on the service amount before tax.
 */
export const BOOKING_INVOICE_PROCESSING_FEE_RATE = 0.05;
/** Platform application fee rate on service subtotal (must match `square-create-payment` Connect path). */
export const BOOKING_SQUARE_APP_FEE_RATE = 0.021;

export type BookingInvoiceComputed = {
  subtotal: number;
  gst: number;
  qst: number;
  processingFee: number;
  totalCents: number;
  totalDollars: string;
};

/** @param baseAmountCents — service subtotal in cents (before tax & processing fee). */
export function computeBookingInvoiceFromBaseCents(baseAmountCents: number): BookingInvoiceComputed {
  const sub = Math.max(0, baseAmountCents / 100);
  const gstAmt = sub * BOOKING_INVOICE_GST_RATE;
  const qstAmt = (sub + gstAmt) * BOOKING_INVOICE_QST_RATE;
  const proc = sub * BOOKING_INVOICE_PROCESSING_FEE_RATE;
  const total = sub + gstAmt + qstAmt + proc;
  const cents = Math.max(500, Math.round(total * 100));
  return {
    subtotal: sub,
    gst: gstAmt,
    qst: qstAmt,
    processingFee: proc,
    totalCents: cents,
    totalDollars: (cents / 100).toFixed(2),
  };
}
