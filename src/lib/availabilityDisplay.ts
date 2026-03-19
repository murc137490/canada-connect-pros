import type { AvailabilityState } from "@/components/WeekdayAvailability";
import { parseAvailabilityFromStorage } from "@/components/WeekdayAvailability";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_LABELS_EN: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};
const SLOT_LABELS_EN: Record<string, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
};

/**
 * Format stored availability (JSON or key-value string) for display.
 * Never show raw JSON or "mon_morning:true,..." to users.
 */
export function formatAvailabilityForDisplay(
  availability: string | null | undefined,
  locale: "en" | "fr" = "en"
): string | null {
  if (!availability || !availability.trim()) return null;
  const s = availability.trim();

  if (s.startsWith("{")) {
    const parsed = parseAvailabilityFromStorage(s);
    if (parsed) return formatParsedAvailability(parsed, locale);
    return null;
  }

  if (s.includes("_morning") || s.includes("_afternoon") || s.includes("_evening") || s.includes(":true")) {
    const parsed = parseKeyValueAvailability(s);
    if (parsed) return formatParsedAvailability(parsed, locale);
    return null;
  }

  if (s.length > 80 || s.includes('"available"')) return null;
  return s;
}

function parseKeyValueAvailability(s: string): AvailabilityState | null {
  const state: Record<string, { available: boolean; morning: boolean; afternoon: boolean; evening: boolean }> = {};
  const keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  for (const k of keys) {
    state[k] = { available: false, morning: false, afternoon: false, evening: false };
  }
  const pairs = s.split(",").map((p) => p.trim());
  for (const p of pairs) {
    const [key, val] = p.split(":").map((x) => x.trim().toLowerCase());
    if (!key || !val) continue;
    const match = key.match(/^(mon|tue|wed|thu|fri|sat|sun)_(morning|afternoon|evening)$/);
    if (match) {
      const [, day, slot] = match;
      if (state[day] && (val === "true" || val === "1")) {
        state[day].available = true;
        (state[day] as Record<string, boolean>)[slot] = true;
      }
    }
  }
  return state as AvailabilityState;
}

function formatParsedAvailability(state: AvailabilityState, locale: "en" | "fr"): string {
  const parts: string[] = [];
  const dayLabels = locale === "fr"
    ? { mon: "lun.", tue: "mar.", wed: "mer.", thu: "jeu.", fri: "ven.", sat: "sam.", sun: "dim." }
    : WEEKDAY_LABELS_EN;
  const slotLabels = locale === "fr"
    ? { morning: "matin", afternoon: "après-midi", evening: "soir" }
    : SLOT_LABELS_EN;

  for (const day of WEEKDAY_ORDER) {
    const d = state[day];
    if (!d?.available) continue;
    const slots: string[] = [];
    if (d.morning) slots.push(slotLabels.morning);
    if (d.afternoon) slots.push(slotLabels.afternoon);
    if (d.evening) slots.push(slotLabels.evening);
    if (slots.length) parts.push(`${dayLabels[day]}: ${slots.join(", ")}`);
  }
  return parts.length ? parts.join("; ") : "";
}
