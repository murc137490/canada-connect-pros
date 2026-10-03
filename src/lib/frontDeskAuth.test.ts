import { describe, expect, it } from "vitest";
import { normalizeFrontDeskLanguage, resolveOtpMemberId, telnyxOtpAccepted } from "../../supabase/functions/_shared/frontDeskAuth";

describe("Front Desk language and OTP account routing", () => {
  it.each([
    ["en", "en"],
    ["FR", "fr"],
    ["es", "es"],
    ["ar", "ar"],
    ["", null],
    ["de", null],
  ])("normalizes a caller language choice: %s", (input, expected) => {
    expect(normalizeFrontDeskLanguage(input)).toBe(expected);
  });

  it("accepts only Telnyx's explicit valid=true result", () => {
    expect(telnyxOtpAccepted(200, { valid: true })).toBe(true);
    expect(telnyxOtpAccepted(200, { valid: false })).toBe(false);
    expect(telnyxOtpAccepted(200, { status: "rejected" })).toBe(false);
    expect(telnyxOtpAccepted(400, { valid: true })).toBe(false);
    expect(telnyxOtpAccepted(200, null)).toBe(false);
  });

  it("uses a phone-matched account when no Member ID was entered", () => {
    expect(resolveOtpMemberId("", "4821")).toBe("4821");
    expect(resolveOtpMemberId(undefined, "4820")).toBe("4820");
  });

  it("uses an entered Member ID and rejects invalid IDs instead of falling back", () => {
    expect(resolveOtpMemberId(" 1234 ", "5678")).toBe("1234");
    expect(resolveOtpMemberId("123456", "5678")).toBeNull();
    expect(resolveOtpMemberId("", "123456")).toBeNull();
  });
});
