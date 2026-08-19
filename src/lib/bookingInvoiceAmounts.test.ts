import { describe, expect, it } from "vitest";
import {
  BOOKING_INVOICE_PROCESSING_FEE_RATE,
  BOOKING_SQUARE_APP_FEE_RATE,
  computeBookingInvoiceFromBaseCents,
} from "@/lib/bookingInvoiceAmounts";
import { PLATFORM_FEE_RATE, SQUARE_CONNECT_APP_FEE_RATE } from "@/config/legalConfig";

describe("platform fee consistency", () => {
  it("uses 5% platform fee from central config", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.05);
    expect(BOOKING_INVOICE_PROCESSING_FEE_RATE).toBe(0.05);
  });

  it("keeps Connect app fee as implementation detail rate", () => {
    expect(SQUARE_CONNECT_APP_FEE_RATE).toBe(0.021);
    expect(BOOKING_SQUARE_APP_FEE_RATE).toBe(0.021);
  });

  it("computes $200 service with 5% platform fee", () => {
    const r = computeBookingInvoiceFromBaseCents(20000);
    expect(r.subtotal).toBe(200);
    expect(r.platformFee).toBeCloseTo(10, 5);
    expect(r.processingFee).toBeCloseTo(10, 5);
  });
});
