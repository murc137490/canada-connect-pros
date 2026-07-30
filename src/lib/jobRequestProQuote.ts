/** Helpers for the pro “send quote” dialog: constraints from customer scheduling fields. */

import { format, parseISO } from "date-fns";

export type JobSchedSlice = {
  scheduling_mode?: string | null;
  preferred_date?: string | null;
  preferred_datetime?: string | null;
  /** Human-readable scheduling summary from Make a Request */
  preferred_time_window?: string | null;
  range_start_date?: string | null;
  range_end_date?: string | null;
  exact_time?: string | null;
  window_time_start?: string | null;
  window_time_end?: string | null;
  time_window_code?: string | null;
};

/** One-line summary of the customer’s fixed slot (exact scheduling mode). */
export function formatCustomerExactSlotLine(job: JobSchedSlice): string {
  const day = job.preferred_date ? parseScheduleDay(job.preferred_date) : undefined;
  const tm = job.exact_time?.trim();
  if (day && tm) return `${format(day, "PPP")} at ${tm}`;
  const pd = job.preferred_datetime?.trim();
  if (pd) {
    try {
      const d = parseISO(pd);
      if (!Number.isNaN(d.getTime())) return format(d, "PPP 'at' p");
    } catch {
      /* ignore */
    }
  }
  const fallback = job.preferred_time_window?.trim();
  return fallback || "-";
}

/** Customer chose a single fixed date + time (Make a Request “exact” mode). */
export function customerRequestedExactSlot(job: JobSchedSlice): boolean {
  return (job.scheduling_mode ?? "").toLowerCase() === "exact";
}

export function parseScheduleDay(isoDate: string | null | undefined): Date | undefined {
  if (!isoDate?.trim()) return undefined;
  const d = new Date(`${isoDate.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Disable calendar days the customer did not offer (range / single day). Past days disabled. */
export function disableDatesOutsideCustomerChoice(job: JobSchedSlice): (date: Date) => boolean {
  const mode = (job.scheduling_mode ?? "").toLowerCase();

  return (date: Date) => {
    const t = startOfLocalDay(date);
    const today = startOfLocalDay(new Date());
    if (t < today) return true;

    if (mode === "range") {
      const from = job.range_start_date ? parseScheduleDay(job.range_start_date) : undefined;
      const to = job.range_end_date ? parseScheduleDay(job.range_end_date) : undefined;
      const fromT = from ? startOfLocalDay(from) : null;
      const toT = to ? startOfLocalDay(to) : null;
      if (fromT != null && t < fromT) return true;
      if (toT != null && t > toT) return true;
      return false;
    }

    if (mode === "specific_day") {
      const pd = job.preferred_date ? parseScheduleDay(job.preferred_date) : undefined;
      if (!pd) return false;
      return t !== startOfLocalDay(pd);
    }

    return false;
  };
}

/** Default bounds when customer picks morning/afternoon/evening without custom hours (matches Make a Request copy). */
const WINDOW_CODE_DEFAULTS: Record<string, { from: string; to: string }> = {
  morning: { from: "08:00", to: "12:00" },
  afternoon: { from: "12:00", to: "16:00" },
  evening: { from: "16:00", to: "20:00" },
  flexible: { from: "08:00", to: "20:00" },
};

function normalizeHm(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeToMinutes(hm: string): number {
  const n = normalizeHm(hm);
  if (!n) return NaN;
  const [h, m] = n.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

/** Effective allowed time window for the customer request (for validating pro’s from–to). */
export function effectiveCustomerTimeBounds(job: JobSchedSlice): { from: string; to: string } | null {
  const ws = normalizeHm(job.window_time_start ?? "") ?? "";
  const we = normalizeHm(job.window_time_end ?? "") ?? "";
  if (ws && we && timeToMinutes(ws) <= timeToMinutes(we)) {
    return { from: ws, to: we };
  }
  if (ws && !we) return { from: ws, to: "23:59" };
  if (!ws && we) return { from: "00:00", to: we };

  const code = (job.time_window_code ?? "").trim().toLowerCase();
  if (code && WINDOW_CODE_DEFAULTS[code]) {
    return WINDOW_CODE_DEFAULTS[code];
  }
  return null;
}

/** Returns error message if pro times are outside customer bounds; null if OK or not applicable. */
export function validateProTimeWindow(
  job: JobSchedSlice,
  proFrom: string,
  proTo: string
): string | null {
  const pf = normalizeHm(proFrom);
  const pt = normalizeHm(proTo);
  if (!pf || !pt) return null;
  if (timeToMinutes(pf) > timeToMinutes(pt)) {
    return "Your start time must be before your end time.";
  }
  const bounds = effectiveCustomerTimeBounds(job);
  if (!bounds) return null;
  const b0 = timeToMinutes(bounds.from);
  const b1 = timeToMinutes(bounds.to);
  const p0 = timeToMinutes(pf);
  const p1 = timeToMinutes(pt);
  if (Number.isNaN(b0) || Number.isNaN(b1) || Number.isNaN(p0) || Number.isNaN(p1)) return null;
  if (p0 < b0 || p1 > b1) {
    return `Your time window must fall within the customer's range (${bounds.from}–${bounds.to}).`;
  }
  return null;
}

/** Validate chosen day is allowed for range / specific_day jobs. */
export function validateProChosenDay(job: JobSchedSlice, chosen: Date | undefined): string | null {
  if (!chosen) return null;
  const mode = (job.scheduling_mode ?? "").toLowerCase();
  if (mode === "range") {
    const from = job.range_start_date ? parseScheduleDay(job.range_start_date) : undefined;
    const to = job.range_end_date ? parseScheduleDay(job.range_end_date) : undefined;
    const t = startOfLocalDay(chosen);
    if (from && t < startOfLocalDay(from)) return "Pick a date within the customer's date range.";
    if (to && t > startOfLocalDay(to)) return "Pick a date within the customer's date range.";
  }
  if (mode === "specific_day" && job.preferred_date) {
    const pd = parseScheduleDay(job.preferred_date);
    if (pd && startOfLocalDay(chosen) !== startOfLocalDay(pd)) {
      return "The customer asked for a specific day - use that date.";
    }
  }
  return null;
}

export { normalizeHm, timeToMinutes };
