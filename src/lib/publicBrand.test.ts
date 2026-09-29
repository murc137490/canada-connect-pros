import { describe, expect, it } from "vitest";
import { withAltShiftBrand } from "@/lib/publicBrand";

describe("withAltShiftBrand", () => {
  it("rewrites the legacy brand in review copy", () => {
    expect(withAltShiftBrand("Excellent experience booking through Première Services!")).toBe(
      "Excellent experience booking through AltShift!",
    );
    expect(withAltShiftBrand("Booked on Premiere Services")).toBe("Booked on AltShift");
  });

  it("leaves AltShift text unchanged", () => {
    expect(withAltShiftBrand("Excellent experience booking through AltShift!")).toBe(
      "Excellent experience booking through AltShift!",
    );
  });
});
