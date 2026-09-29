/** Duration used when deciding whether a calendar day still has a bookable start. */
export function bookingSlotDurationMinutes(
  selectedDuration: number | null | undefined,
  serviceDurations: Array<number | null | undefined>,
): number {
  if (typeof selectedDuration === "number" && selectedDuration > 0) return selectedDuration;
  const positives = serviceDurations.filter((n): n is number => typeof n === "number" && n > 0);
  if (positives.length === 0) return 60;
  return Math.min(...positives);
}

/**
 * Hourly start times that fit entirely inside [scheduleStartMin, scheduleEndMin).
 * When nowMinutes is set (today), starts at or before that minute are omitted.
 */
export function bookableStartTimes(opts: {
  scheduleStartMin: number;
  scheduleEndMin: number;
  durationMin: number;
  nowMinutes?: number | null;
}): string[] {
  const { scheduleStartMin, scheduleEndMin, durationMin, nowMinutes } = opts;
  if (durationMin <= 0 || scheduleEndMin <= scheduleStartMin) return [];
  const out: string[] = [];
  for (let startMin = scheduleStartMin; startMin + durationMin <= scheduleEndMin; startMin += 60) {
    if (nowMinutes != null && startMin <= nowMinutes) continue;
    const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
    const mm = String(startMin % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}
