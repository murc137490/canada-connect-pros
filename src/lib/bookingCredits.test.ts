import { describe, expect, it } from "vitest";
import { bookingCreditsInsufficientMessage, bookingCreditsRequired } from "@/lib/bookingCredits";

describe("Booking Credits", () => {
  it.each([
    [0, 0], [1, 1], [100, 1], [9900, 1], [10000, 1], [10100, 2], [19900, 2],
    [20000, 2], [20100, 3], [45000, 5], [80000, 8], [80100, 9], [125000, 13],
  ])("requires %i cents to use %i credits", (cents, credits) => {
    expect(bookingCreditsRequired(cents)).toBe(credits);
  });

  it("rejects fractional or negative cents", () => {
    expect(() => bookingCreditsRequired(-1)).toThrow(RangeError);
    expect(() => bookingCreditsRequired(1.5)).toThrow(RangeError);
  });

  it("explains an insufficient balance in the caller's language", () => {
    const error = new Error("booking_credits_insufficient: required 8 available 5");
    expect(bookingCreditsInsufficientMessage(error, "en")).toContain("requires 8 Booking Credits");
    expect(bookingCreditsInsufficientMessage(error, "fr")).toContain("nécessite 8 crédits de réservation");
    expect(bookingCreditsInsufficientMessage(new Error("other error"), "en")).toBeNull();
  });
});
