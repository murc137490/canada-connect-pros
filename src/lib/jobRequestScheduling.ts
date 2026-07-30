import { format } from "date-fns";
import { TIME_WINDOW_OPTIONS } from "@/data/makeRequestForm";

export type SchedulingMode = "range" | "specific_day" | "exact";

export type SchedulingFormState = {
  availabilityMode: SchedulingMode;
  preferredTimeWindow: string;
  preferredDate: Date | undefined;
  rangeStartDate: Date | undefined;
  rangeEndDate: Date | undefined;
  startHour: string;
  endHour: string;
  exactTime: string;
};

/** Human-readable line stored in preferred_time_window and shown to pros (locale via `mk`). */
export function buildPreferredTimeWindowString(state: SchedulingFormState, mk: Record<string, string>): string {
  const hourRange =
    state.startHour && state.endHour
      ? `${state.startHour}–${state.endHour}`
      : state.startHour
        ? `from ${state.startHour}`
        : state.endHour
          ? `until ${state.endHour}`
          : "";

  if (state.availabilityMode === "range") {
    if (!state.rangeStartDate && !state.rangeEndDate) return "";
    const dateRange = state.rangeStartDate
      ? `${format(state.rangeStartDate, "PPP")}${state.rangeEndDate ? ` to ${format(state.rangeEndDate, "PPP")}` : ""}`
      : "Flexible dates";
    return dateRange;
  }

  if (state.availabilityMode === "exact") {
    if (!state.preferredDate && !state.exactTime) return "";
    return ["Set date and time", state.preferredDate ? format(state.preferredDate, "PPP") : "", state.exactTime ? `at ${state.exactTime}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  const option = TIME_WINDOW_OPTIONS.find((o) => o.value === state.preferredTimeWindow);
  const selectedWindow = option ? mk[option.labelKey] ?? "" : "";

  if (state.availabilityMode === "specific_day") {
    if (state.preferredTimeWindow === "flexible") {
      return [selectedWindow, hourRange].filter(Boolean).join(", ");
    }
    return selectedWindow;
  }

  return [selectedWindow, hourRange ? `Available ${hourRange}` : ""].filter(Boolean).join(", ");
}

export function schedulingDbFieldsFromFormState(
  state: SchedulingFormState,
  mk: Record<string, string>
): {
  scheduling_mode: string | null;
  time_window_code: string | null;
  range_start_date: string | null;
  range_end_date: string | null;
  exact_time: string | null;
  window_time_start: string | null;
  window_time_end: string | null;
  preferred_time_window: string | null;
} {
  const pw = buildPreferredTimeWindowString(state, mk);
  const isoDate = (d: Date | undefined) => (d ? format(d, "yyyy-MM-dd") : null);
  const rangeOrFlexStart =
    state.availabilityMode === "specific_day" && state.preferredTimeWindow === "flexible";
  return {
    scheduling_mode: state.availabilityMode,
    time_window_code: state.preferredTimeWindow.trim() ? state.preferredTimeWindow.trim() : null,
    range_start_date: state.availabilityMode === "range" ? isoDate(state.rangeStartDate) : null,
    range_end_date: state.availabilityMode === "range" ? isoDate(state.rangeEndDate) : null,
    exact_time: state.availabilityMode === "exact" && state.exactTime.trim() ? state.exactTime.trim() : null,
    window_time_start: rangeOrFlexStart ? state.startHour.trim() || null : null,
    window_time_end: rangeOrFlexStart ? state.endHour.trim() || null : null,
    preferred_time_window: pw || null,
  };
}

/** Restore Make-a-Request scheduling from DB; supports legacy rows without structured columns. */
export function hydrateSchedulingFormFromRow(row: {
  scheduling_mode?: string | null;
  time_window_code?: string | null;
  range_start_date?: string | null;
  range_end_date?: string | null;
  exact_time?: string | null;
  window_time_start?: string | null;
  window_time_end?: string | null;
  preferred_date?: string | null;
  preferred_time_window?: string | null;
}): SchedulingFormState {
  if (row.scheduling_mode === "range" || row.scheduling_mode === "specific_day" || row.scheduling_mode === "exact") {
    return {
      availabilityMode: row.scheduling_mode,
      preferredTimeWindow: row.time_window_code ?? "",
      preferredDate: row.preferred_date ? new Date(`${row.preferred_date}T12:00:00`) : undefined,
      rangeStartDate: row.range_start_date ? new Date(`${row.range_start_date}T12:00:00`) : undefined,
      rangeEndDate: row.range_end_date ? new Date(`${row.range_end_date}T12:00:00`) : undefined,
      startHour: row.window_time_start ?? "",
      endHour: row.window_time_end ?? "",
      exactTime: row.exact_time ?? "",
    };
  }

  const raw = (row.preferred_time_window ?? "").trim();

  if (/^Set date and time/i.test(raw)) {
    const atMatch = raw.match(/\bat\s+(\d{1,2}:\d{2})/);
    return {
      availabilityMode: "exact",
      preferredTimeWindow: "",
      preferredDate: row.preferred_date ? new Date(`${row.preferred_date}T12:00:00`) : undefined,
      rangeStartDate: undefined,
      rangeEndDate: undefined,
      startHour: "",
      endHour: "",
      exactTime: atMatch?.[1] ?? "",
    };
  }

  if (/, within\s+/i.test(raw) || /^Flexible dates/i.test(raw)) {
    const within = raw.match(/within\s+([\d:]+)\s*[\-–]\s*([\d:]+)/i);
    return {
      availabilityMode: "range",
      preferredTimeWindow: "",
      preferredDate: undefined,
      rangeStartDate: undefined,
      rangeEndDate: undefined,
      startHour: within?.[1] ?? "",
      endHour: within?.[2] ?? "",
      exactTime: "",
    };
  }

  let timeWindow = "";
  if (/Flexible hours|Horaire flexible/i.test(raw)) timeWindow = "flexible";
  else if (/Morning|Matin \(8/i.test(raw) || /^Morning\b/i.test(raw)) timeWindow = "morning";
  else if (/Afternoon|Après-midi/i.test(raw)) timeWindow = "afternoon";
  else if (/Evening|Soir/i.test(raw)) timeWindow = "evening";

  const flexHours = raw.match(/([\d]{1,2}:\d{2})\s*[\-–]\s*([\d]{1,2}:\d{2})/);

  return {
    availabilityMode: "specific_day",
    preferredTimeWindow: timeWindow,
    preferredDate: row.preferred_date ? new Date(`${row.preferred_date}T12:00:00`) : undefined,
    rangeStartDate: undefined,
    rangeEndDate: undefined,
    startHour: timeWindow === "flexible" ? flexHours?.[1] ?? "" : "",
    endHour: timeWindow === "flexible" ? flexHours?.[2] ?? "" : "",
    exactTime: "",
  };
}

/** Local wall-clock datetime for exact scheduling (same as Make a Request). */
export function createLocalDateTime(date: Date, time: string): Date | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
}
