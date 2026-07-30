/**
 * `preferredTime` like "09:00" or "09:00:00" (24h).
 * Returns same style "HH:MM" for end, or null if start unparseable.
 */
export function endTimeAfterMinutes(preferredTime: string | null | undefined, durationMins: number | null | undefined): string | null {
  if (durationMins == null || durationMins <= 0) return null;
  const s = preferredTime?.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  let mi = parseInt(m[2], 10);
  if (h > 23 || mi > 59) return null;
  const total = h * 60 + mi + durationMins;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

/** Label for calendar row: "09:00–11:00" or "09:00" if no duration */
export function formatBookingTimeRange(preferredTime: string | null | undefined, durationMins: number | null | undefined): string {
  const start = preferredTime?.trim() ? String(preferredTime).slice(0, 5) : "";
  if (!start) return "";
  const end = endTimeAfterMinutes(preferredTime, durationMins);
  if (end) return `${start}–${end}`;
  return start;
}
