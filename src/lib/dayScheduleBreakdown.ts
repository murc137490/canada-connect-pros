import type { UnavailableDayStored } from "@/lib/unavailableDates";
import { getUnavailableSlots, isWholeDayUnavailable, getUnavailableNote } from "@/lib/unavailableDates";
import type { WeekdayKey } from "@/i18n/constants";
import type { WeeklyScheduleState } from "@/components/pro/ProScheduleEditor";
import { endTimeAfterMinutes } from "@/lib/bookingTimeRange";

function parseHHMM(s: string | undefined | null): number | null {
  if (!s?.trim()) return null;
  const m = String(s).match(/^\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function fmt(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type DayBreakdownSegment =
  | { kind: "template_off" }
  | { kind: "window"; mode: "weekly" | "override"; start: string; end: string }
  | { kind: "blocked_day"; note?: string }
  | { kind: "unavailable_slot"; start: string; end: string; note?: string }
  | { kind: "booking"; label: string; start: string; end: string; status?: string }
  | { kind: "free"; start: string; end: string };

const OVERRIDE_START = "09:00";
const OVERRIDE_END = "17:00";

export function weekdayKeyFromDateStr(dateStr: string): WeekdayKey {
  const d = new Date(`${dateStr}T12:00:00`);
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[d.getDay()];
}

export function buildDayBreakdownSegments(args: {
  dateStr: string;
  weekly: WeeklyScheduleState;
  unavailableEntry: UnavailableDayStored | undefined;
  isOverride: boolean;
  isAvailableByWeekday: boolean;
  bookings: { time?: string; label: string; status?: string; durationMinutes?: number | null }[];
}): DayBreakdownSegment[] {
  const { dateStr, weekly, unavailableEntry, isOverride, isAvailableByWeekday, bookings } = args;
  const wk = weekdayKeyFromDateStr(dateStr);
  const day = weekly[wk];
  const out: DayBreakdownSegment[] = [];

  let winStart: number | null = null;
  let winEnd: number | null = null;

  if (isOverride) {
    winStart = parseHHMM(OVERRIDE_START);
    winEnd = parseHHMM(OVERRIDE_END);
    out.push({ kind: "window", mode: "override", start: OVERRIDE_START, end: OVERRIDE_END });
  } else if (!day.available || !isAvailableByWeekday) {
    out.push({ kind: "template_off" });
    return out;
  } else {
    winStart = parseHHMM(day.start);
    winEnd = parseHHMM(day.end);
    if (winStart == null || winEnd == null || winEnd <= winStart) {
      return [{ kind: "template_off" }];
    }
    out.push({ kind: "window", mode: "weekly", start: day.start, end: day.end });
  }

  if (winStart == null || winEnd == null || winEnd <= winStart) return out;

  const note = getUnavailableNote(unavailableEntry);
  if (isWholeDayUnavailable(unavailableEntry)) {
    out.push({ kind: "blocked_day", note });
    return out;
  }

  for (const slot of getUnavailableSlots(unavailableEntry)) {
    const a = parseHHMM(slot.start);
    const b = parseHHMM(slot.end);
    if (a == null || b == null || b <= a) continue;
    out.push({
      kind: "unavailable_slot",
      start: fmt(Math.max(a, winStart)),
      end: fmt(Math.min(b, winEnd)),
      note,
    });
  }

  for (const b of bookings) {
    const start = b.time?.trim() ? String(b.time).slice(0, 5) : "";
    const sm = parseHHMM(start);
    if (sm == null) {
      out.push({ kind: "booking", label: b.label, start: "—", end: "—", status: b.status });
      continue;
    }
    const dur = b.durationMinutes ?? 60;
    const endStr = endTimeAfterMinutes(start, dur) ?? start;
    const em = parseHHMM(endStr);
    out.push({
      kind: "booking",
      label: b.label,
      start: fmt(sm),
      end: em != null ? fmt(em) : endStr,
      status: b.status,
    });
  }

  const blocks: { s: number; e: number }[] = [];
  for (const slot of getUnavailableSlots(unavailableEntry)) {
    const a = parseHHMM(slot.start);
    const b = parseHHMM(slot.end);
    if (a == null || b == null || b <= a) continue;
    blocks.push({ s: Math.max(a, winStart), e: Math.min(b, winEnd) });
  }
  for (const b of bookings) {
    const sm = parseHHMM(b.time?.trim() ? String(b.time).slice(0, 5) : "");
    if (sm == null) continue;
    const dur = b.durationMinutes ?? 60;
    const endStr = endTimeAfterMinutes(b.time ?? "", dur) ?? "";
    const em = parseHHMM(endStr);
    if (em == null) continue;
    blocks.push({ s: Math.max(sm, winStart), e: Math.min(em, winEnd) });
  }
  blocks.sort((x, y) => x.s - y.s);
  const merged: { s: number; e: number }[] = [];
  for (const b of blocks) {
    const last = merged[merged.length - 1];
    if (!last || b.s > last.e) merged.push({ ...b });
    else last.e = Math.max(last.e, b.e);
  }

  let cursor = winStart;
  for (const b of merged) {
    if (b.s > cursor) {
      out.push({ kind: "free", start: fmt(cursor), end: fmt(Math.min(b.s, winEnd)) });
    }
    cursor = Math.max(cursor, b.e);
  }
  if (cursor < winEnd) {
    out.push({ kind: "free", start: fmt(cursor), end: fmt(winEnd) });
  }

  return out;
}
