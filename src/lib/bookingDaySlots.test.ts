import { describe, expect, it } from "vitest";
import { bookableStartTimes, bookingSlotDurationMinutes } from "@/lib/bookingDaySlots";

describe("bookingSlotDurationMinutes", () => {
  it("uses the selected service duration", () => {
    expect(bookingSlotDurationMinutes(90, [60, 120])).toBe(90);
  });

  it("uses the shortest listed service when none is selected", () => {
    expect(bookingSlotDurationMinutes(null, [90, 120, 60])).toBe(60);
  });

  it("falls back to 60 minutes when durations are missing", () => {
    expect(bookingSlotDurationMinutes(undefined, [null, 0])).toBe(60);
  });
});

describe("bookableStartTimes", () => {
  it("omits today starts that have already passed", () => {
    const times = bookableStartTimes({
      scheduleStartMin: 9 * 60,
      scheduleEndMin: 17 * 60,
      durationMin: 60,
      nowMinutes: 16 * 60,
    });
    expect(times).toEqual([]);
  });

  it("keeps a later start that still fits", () => {
    const times = bookableStartTimes({
      scheduleStartMin: 9 * 60,
      scheduleEndMin: 17 * 60,
      durationMin: 60,
      nowMinutes: 15 * 60 + 30,
    });
    expect(times).toEqual(["16:00"]);
  });

  it("uses a longer duration so the last hour is not bookable", () => {
    const times = bookableStartTimes({
      scheduleStartMin: 9 * 60,
      scheduleEndMin: 17 * 60,
      durationMin: 90,
      nowMinutes: 15 * 60,
    });
    expect(times).toEqual([]);
  });
});
