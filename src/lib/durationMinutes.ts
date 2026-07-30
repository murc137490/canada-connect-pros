/** Client booking / pro service duration in minutes. */

export const DURATION_INCREMENT_MIN = 15;
export const DURATION_MAX_MIN = 8 * 60;

export function normalizeDurationMinutes(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const minutes = Math.max(1, Math.floor(n));
  const rounded = minutes > 120 ? Math.round(minutes / DURATION_INCREMENT_MIN) * DURATION_INCREMENT_MIN : minutes;
  return Math.min(DURATION_MAX_MIN, rounded);
}

/** Digits only; empty => null. Durations above 120 round to the closest 15 minutes, capped at 8 hours. */
export function parseDurationDigits(raw: string): number | null {
  const formatted = raw
    .trim()
    .toLowerCase()
    .match(/^(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes)?)?$/);
  if (formatted) {
    const hours = parseInt(formatted[1], 10);
    const mins = formatted[2] ? parseInt(formatted[2], 10) : 0;
    return normalizeDurationMinutes(hours * 60 + mins);
  }
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  return normalizeDurationMinutes(parseInt(d, 10));
}

/**
 * Display in the duration field: 120 -> "2h00"; >120 -> "2h15", "2h30", "2h45".
 */
export function formatDurationFieldValue(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "";
  if (minutes < 120) return String(minutes);
  return formatHoursMinutes(minutes);
}

/** For checkout / labels: "2h00" | "2h30" | "90 min" | "1 min" */
export function formatDurationLabel(minutes: number | null): string | null {
  if (minutes == null || minutes === 0) return null;
  if (minutes >= 120) return formatHoursMinutes(minutes);
  if (minutes === 1) return "1 min";
  return `${minutes} min`;
}

function formatHoursMinutes(minutes: number): string {
  const normalized = normalizeDurationMinutes(minutes);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

/** Remove legacy duration lines from stored description (about text only). */
export function stripLegacyDurationFromDescription(desc: string | null): string {
  if (!desc?.trim()) return "";
  return desc
    .split("\n")
    .filter((line) => !/^\s*Duration:\s*/i.test(line) && !/^\s*DURATION_MINS:\s*/i.test(line))
    .join("\n")
    .trim();
}
