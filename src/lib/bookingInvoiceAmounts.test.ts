import { describe, expect, it } from "vitest";
import {
  BOOKING_INVOICE_PROCESSING_FEE_RATE,
  computeBookingInvoiceFromBaseCents,
  estimateAltShiftApplicationFeeCents,
  estimateSquareOnlineProcessingCents,
} from "@/lib/bookingInvoiceAmounts";
import { PLATFORM_FEE_RATE } from "@/config/legalConfig";
import { bookingFeeRateBps } from "../../supabase/functions/_shared/bookingPaymentMath";

describe("platform fee consistency", () => {
  it("uses 5% now and schedules 3.8% for January 1, 2027", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.05);
    expect(bookingFeeRateBps(new Date("2026-12-31T23:59:59Z"))).toBe(500);
    expect(bookingFeeRateBps(new Date("2027-01-01T00:00:00Z"))).toBe(380);
    expect(BOOKING_INVOICE_PROCESSING_FEE_RATE).toBe(bookingFeeRateBps() / 10000);
  });

  it("deducts estimated Square processing before AltShift's share", () => {
    expect(estimateSquareOnlineProcessingCents(10000)).toBe(310);
    expect(estimateAltShiftApplicationFeeCents(10000, 10000)).toBe(190);
    expect(estimateAltShiftApplicationFeeCents(100000, 100000)).toBe(2170);
    expect(estimateAltShiftApplicationFeeCents(10000, 20000)).toBe(0);
  });

  it("keeps the processor's estimated share inside the capped customer fee", () => {
    const invoice = computeBookingInvoiceFromBaseCents(10000);
    expect(invoice.totalCents).toBe(12047);
    expect(estimateAltShiftApplicationFeeCents(10000, invoice.totalCents)).toBe(133);
  });

  it("computes $200 service with the 5% current booking fee", () => {
    const r = computeBookingInvoiceFromBaseCents(20000);
    expect(r.subtotal).toBe(200);
    expect(r.platformFee).toBeCloseTo(10, 5);
    expect(r.processingFee).toBeCloseTo(10, 5);
  });

  it("uses a 3.8% booking fee for invoices created on January 1, 2027", () => {
    const r = computeBookingInvoiceFromBaseCents(10000, new Date("2027-01-01T00:00:00Z"));
    expect(r.platformFee).toBeCloseTo(3.8, 5);
    expect(r.totalCents).toBe(11927);
    expect(estimateAltShiftApplicationFeeCents(10000, r.totalCents, new Date("2027-01-01T00:00:00Z"))).toBe(16);
  });

  it("rounds each tax and platform fee once in cents", () => {
    const r = computeBookingInvoiceFromBaseCents(10001);
    expect(r.subtotal).toBe(100.01);
    expect(r.gst).toBe(5);
    expect(r.qst).toBe(10.47);
    expect(r.platformFee).toBe(5);
    expect(r.totalCents).toBe(12048);
  });
});
