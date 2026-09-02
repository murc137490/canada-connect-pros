import { useEffect, useMemo, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/i18n/constants";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2 } from "lucide-react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import type { UnavailableDatesMap, UnavailableDayStored, UnavailableTimeSlot } from "@/lib/unavailableDates";
import { getUnavailableNote, getUnavailableSlots, isWholeDayUnavailable } from "@/lib/unavailableDates";
import { buildDayBreakdownSegments, type DayBreakdownSegment, weekdayKeyFromDateStr } from "@/lib/dayScheduleBreakdown";

const WEEKDAY_LABELS: Record<WeekdayKey, keyof typeof import("@/i18n/translations").translations.en.createPro> = {
  mon: "weekdayMon",
  tue: "weekdayTue",
  wed: "weekdayWed",
  thu: "weekdayThu",
  fri: "weekdayFri",
  sat: "weekdaySat",
  sun: "weekdaySun",
};

/** Hour options for dropdowns: 6:00–22:00 in 1h steps */
const HOUR_OPTIONS = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 22; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out;
})();

function parseHHMMToMinutes(s: string): number | null {
  const m = String(s).match(/^\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Start times within a working window (end must still fit after start). */
function getBlockStartOptions(window: { start: string; end: string }): string[] {
  const ws = parseHHMMToMinutes(window.start);
  const we = parseHHMMToMinutes(window.end);
  if (ws == null || we == null || we <= ws) return [];
  return HOUR_OPTIONS.filter((opt) => {
    const m = parseHHMMToMinutes(opt);
    return m != null && m >= ws && m < we;
  });
}

/** End times after block start, up to working window end. */
function getBlockEndOptions(window: { start: string; end: string }, blockStart: string): string[] {
  const bs = parseHHMMToMinutes(blockStart);
  const we = parseHHMMToMinutes(window.end);
  if (bs == null || we == null || we <= bs) return [];
  return HOUR_OPTIONS.filter((opt) => {
    const m = parseHHMMToMinutes(opt);
    return m != null && m > bs && m <= we;
  });
}

function clampSlotToWindow(
  slot: UnavailableTimeSlot,
  window: { start: string; end: string },
): UnavailableTimeSlot {
  const startOpts = getBlockStartOptions(window);
  const start = startOpts.includes(slot.start) ? slot.start : (startOpts[0] ?? window.start);
  const endOpts = getBlockEndOptions(window, start);
  const end = endOpts.includes(slot.end) ? slot.end : (endOpts[0] ?? window.end);
  return { start, end };
}

function slotsOverlapPairwise(slots: UnavailableTimeSlot[]): boolean {
  const ranges = slots
    .map((s) => ({ a: parseHHMMToMinutes(s.start), b: parseHHMMToMinutes(s.end) }))
    .filter((x): x is { a: number; b: number } => x.a != null && x.b != null && x.b > x.a)
    .sort((x, y) => x.a - y.a);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].a < ranges[i - 1].b) return true;
  }
  return false;
}

export type WeekdaySchedule = { available: boolean; start: string; end: string };
export type WeeklyScheduleState = Record<WeekdayKey, WeekdaySchedule>;

export const defaultWeeklySchedule = (): WeeklyScheduleState =>
  WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = { available: false, start: "09:00", end: "17:00" };
    return acc;
  }, {} as WeeklyScheduleState);

/** Serialize weekly schedule to same JSON shape we store in availability column (keeps .available for parseAvailableWeekdays). */
export function weeklyScheduleToAvailability(weekly: WeeklyScheduleState): string {
  const obj: Record<string, { available: boolean; start?: string; end?: string }> = {};
  WEEKDAY_KEYS.forEach((key) => {
    obj[key] = { available: weekly[key].available, start: weekly[key].start, end: weekly[key].end };
  });
  return JSON.stringify(obj);
}

/** Parse availability string from DB into weekly schedule. Handles old format (morning/afternoon/evening) and new (start/end). */
export function parseAvailabilityToWeekly(availability: string | null | undefined): WeeklyScheduleState {
  const defaultState = defaultWeeklySchedule();
  if (!availability?.trim()) return defaultState;
  const s = availability.trim();
  if (!s.startsWith("{")) return defaultState;
  try {
    const parsed = JSON.parse(s) as Record<string, { available?: boolean; morning?: boolean; afternoon?: boolean; evening?: boolean; start?: string; end?: string }>;
    WEEKDAY_KEYS.forEach((key) => {
      const day = parsed[key];
      if (!day) return;
      const available = !!day.available || !!(day.morning || day.afternoon || day.evening);
      defaultState[key] = {
        available,
        start: (day as { start?: string }).start ?? "09:00",
        end: (day as { end?: string }).end ?? "17:00",
      };
    });
    return defaultState;
  } catch {
    return defaultState;
  }
}

export interface ProScheduleEditorProps {
  weekly: WeeklyScheduleState;
  unavailableDates: UnavailableDatesMap;
  availableDateOverrides: string[];
  onWeeklyChange: (weekly: WeeklyScheduleState) => void;
  onUnavailableDatesChange: (dates: UnavailableDatesMap) => void;
  onAvailableDateOverridesChange: (dates: string[]) => void;
  /** Busy dates (e.g. from bookings) to show on the calendar */
  busyDates?: string[];
  /** Color for available days (e.g. pro's Public page appearance primary). */
  availableDayColor?: string;
  /** Optional: show bookings on the calendar (dateStr, client label, time). */
  bookingEvents?: {
    dateStr: string;
    label: string;
    time?: string;
    status?: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    durationMinutes?: number | null;
  }[];
  /** Use larger calendar (e.g. in booking history view). */
  calendarSize?: "default" | "large";
  /**
   * Starter tier: YYYY-MM-DD of the last day in the plan window (rolling from today, e.g. +30 days).
   * Omitted for Growth/Pro (full calendar).
   */
  scheduleWindowEndDateStr?: string;
  /** When the user goes past the window (month nav, picker, or day click). */
  onNavigateBeyondScheduleWindow?: () => void;
  /** Save blocked hours / day overrides without saving the full weekly template. */
  onSaveBlockedHours?: () => void | Promise<void>;
  savingBlockedHours?: boolean;
}

function formatBreakdownLine(
  seg: DayBreakdownSegment,
  d: typeof import("@/i18n/translations").translations.en.dashboard | undefined
): string {
  switch (seg.kind) {
    case "template_off":
      return d?.dayBreakdownTemplateOff ?? "This weekday is not on your usual availability.";
    case "window":
      if (seg.mode === "override") {
        return (d?.dayBreakdownOverrideWindow ?? "One-off available day: {{start}}–{{end}}")
          .replace("{{start}}", seg.start)
          .replace("{{end}}", seg.end);
      }
      return (d?.dayBreakdownWeeklyWindow ?? "Regular hours: {{start}}–{{end}}")
        .replace("{{start}}", seg.start)
        .replace("{{end}}", seg.end);
    case "blocked_day":
      return (d?.dayBreakdownBlockedDay ?? "Unavailable (whole day)") + (seg.note ? ` - ${seg.note}` : "");
    case "unavailable_slot":
      return (
        (d?.dayBreakdownBlockedSlot ?? "Blocked {{start}}–{{end}}").replace("{{start}}", seg.start).replace("{{end}}", seg.end) +
        (seg.note ? ` - ${seg.note}` : "")
      );
    case "booking":
      return (d?.dayBreakdownBooking ?? "{{label}} {{start}}–{{end}}")
        .replace("{{label}}", seg.label)
        .replace("{{start}}", seg.start)
        .replace("{{end}}", seg.end);
    default:
      return "";
  }
}

export default function ProScheduleEditor({
  weekly,
  unavailableDates,
  availableDateOverrides,
  onWeeklyChange,
  onUnavailableDatesChange,
  onAvailableDateOverridesChange,
  busyDates = [],
  availableDayColor,
  bookingEvents = [],
  calendarSize = "default",
  scheduleWindowEndDateStr,
  onNavigateBeyondScheduleWindow,
  onSaveBlockedHours,
  savingBlockedHours = false,
}: ProScheduleEditorProps) {
  const { t } = useLanguage();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedDateAvailableByWeekday, setSelectedDateAvailableByWeekday] = useState<boolean>(true);
  const [localUnavailableNote, setLocalUnavailableNote] = useState("");

  useEffect(() => {
    if (!selectedDateStr) {
      setLocalUnavailableNote("");
      return;
    }
    setLocalUnavailableNote(getUnavailableNote(unavailableDates[selectedDateStr] as UnavailableDayStored | undefined) ?? "");
  }, [selectedDateStr, unavailableDates]);

  const updateDay = (key: WeekdayKey, patch: Partial<WeekdaySchedule>) => {
    onWeeklyChange({
      ...weekly,
      [key]: { ...weekly[key], ...patch },
    });
  };

  const handleCalendarDayClick = (dateStr: string, isAvailableByWeekday: boolean) => {
    setSelectedDateStr(dateStr);
    setSelectedDateAvailableByWeekday(isAvailableByWeekday);
  };

  const isOverride = selectedDateStr ? availableDateOverrides.includes(selectedDateStr) : false;
  const selectedEntry = selectedDateStr ? (unavailableDates[selectedDateStr] as UnavailableDayStored | undefined) : undefined;
  const wholeDayOff = selectedDateStr ? isWholeDayUnavailable(selectedEntry) : false;
  const dayIsAvailable = selectedDateStr
    ? isOverride
      ? true
      : !wholeDayOff && selectedDateAvailableByWeekday
    : false;
  const blockedSlotsForDay = selectedDateStr ? getUnavailableSlots(selectedEntry) : [];

  const weeklyWindowForSelected = useMemo(() => {
    if (!selectedDateStr) return null;
    if (isOverride) return { start: "09:00", end: "17:00" };
    if (!selectedDateAvailableByWeekday) return null;
    const wk = weekdayKeyFromDateStr(selectedDateStr);
    const d = weekly[wk];
    if (!d.available) return null;
    return { start: d.start, end: d.end };
  }, [selectedDateStr, isOverride, weekly, selectedDateAvailableByWeekday]);

  const canEditDayBlocks = !!selectedDateStr && !!weeklyWindowForSelected && !wholeDayOff;

  const blockedSlotsOverlap = useMemo(() => slotsOverlapPairwise(blockedSlotsForDay), [blockedSlotsForDay]);

  const invalidSlotRange = useMemo(
    () =>
      blockedSlotsForDay.some((slot) => {
        const a = parseHHMMToMinutes(slot.start);
        const b = parseHHMMToMinutes(slot.end);
        return a == null || b == null || b <= a;
      }),
    [blockedSlotsForDay]
  );

  const commitSlots = useCallback(
    (slots: UnavailableTimeSlot[]) => {
      if (!selectedDateStr) return;
      const note = localUnavailableNote.trim();
      const next = { ...unavailableDates };
      if (slots.length === 0) {
        delete next[selectedDateStr];
      } else {
        next[selectedDateStr] = note ? { slots, note } : slots;
      }
      onUnavailableDatesChange(next);
    },
    [selectedDateStr, unavailableDates, localUnavailableNote, onUnavailableDatesChange]
  );

  const blockedSlotsKey = JSON.stringify(blockedSlotsForDay);
  useEffect(() => {
    if (!selectedDateStr || !weeklyWindowForSelected || blockedSlotsForDay.length === 0) return;
    const clamped = blockedSlotsForDay.map((slot) => clampSlotToWindow(slot, weeklyWindowForSelected));
    const changed = clamped.some(
      (slot, i) => slot.start !== blockedSlotsForDay[i]?.start || slot.end !== blockedSlotsForDay[i]?.end,
    );
    if (changed) commitSlots(clamped);
  }, [selectedDateStr, weeklyWindowForSelected, blockedSlotsKey, commitSlots, blockedSlotsForDay.length]);

  const persistUnavailableNote = () => {
    if (!selectedDateStr || !wholeDayOff) return;
    const note = localUnavailableNote.trim();
    const cur = unavailableDates[selectedDateStr] as UnavailableDayStored | undefined;
    let nextVal: UnavailableDayStored;

    if (cur === true) {
      nextVal = note ? { wholeDay: true, note } : true;
    } else if (Array.isArray(cur)) {
      nextVal = note ? { slots: cur, note } : cur;
    } else if (cur && typeof cur === "object") {
      const o = cur as { wholeDay?: boolean; slots?: { start: string; end: string }[] };
      if (isWholeDayUnavailable(cur)) {
        nextVal = note ? { wholeDay: true, note } : true;
      } else if (o.slots && o.slots.length > 0) {
        nextVal = note ? { slots: o.slots, note } : o.slots;
      } else {
        nextVal = note ? { wholeDay: true, note } : true;
      }
    } else {
      nextVal = note ? { wholeDay: true, note } : true;
    }

    onUnavailableDatesChange({ ...unavailableDates, [selectedDateStr]: nextVal });
  };

  const persistSlotClientNote = () => {
    if (!selectedDateStr || wholeDayOff || blockedSlotsForDay.length === 0) return;
    commitSlots(blockedSlotsForDay);
  };

  const markSelectedDateUnavailable = () => {
    if (!selectedDateStr) return;
    const note = localUnavailableNote.trim();
    onUnavailableDatesChange({
      ...unavailableDates,
      [selectedDateStr]: note ? { wholeDay: true, note } : true,
    });
    onAvailableDateOverridesChange(availableDateOverrides.filter((d) => d !== selectedDateStr));
  };

  const markSelectedDateAvailable = () => {
    if (!selectedDateStr) return;
    const cur = unavailableDates[selectedDateStr] as UnavailableDayStored | undefined;
    const nextUnavailable = { ...unavailableDates };

    if (isWholeDayUnavailable(cur)) {
      const slots = getUnavailableSlots(cur);
      const note = (getUnavailableNote(cur) ?? "").trim() || localUnavailableNote.trim();
      if (slots.length > 0) {
        nextUnavailable[selectedDateStr] = note ? { slots, note } : slots;
      } else {
        delete nextUnavailable[selectedDateStr];
      }
    }

    const nextOverrides = selectedDateAvailableByWeekday
      ? availableDateOverrides.filter((d) => d !== selectedDateStr)
      : [...availableDateOverrides, selectedDateStr].sort();

    onUnavailableDatesChange(nextUnavailable);
    onAvailableDateOverridesChange(nextOverrides);
  };

  const addBlockedSlot = () => {
    if (!selectedDateStr || !weeklyWindowForSelected) return;
    const startOpts = getBlockStartOptions(weeklyWindowForSelected);
    const preferStart = "12:00";
    const start = startOpts.includes(preferStart) ? preferStart : (startOpts[0] ?? weeklyWindowForSelected.start);
    const endOpts = getBlockEndOptions(weeklyWindowForSelected, start);
    const preferEnd = "13:00";
    const end = endOpts.includes(preferEnd) ? preferEnd : (endOpts[0] ?? weeklyWindowForSelected.end);
    commitSlots([...blockedSlotsForDay, { start, end }]);
  };

  const updateBlockedSlot = (index: number, patch: Partial<UnavailableTimeSlot>) => {
    if (!weeklyWindowForSelected) return;
    const slot = blockedSlotsForDay[index];
    if (!slot) return;
    let start = patch.start ?? slot.start;
    let end = patch.end ?? slot.end;

    const startOpts = getBlockStartOptions(weeklyWindowForSelected);
    if (!startOpts.includes(start)) start = startOpts[0] ?? weeklyWindowForSelected.start;

    const endOpts = getBlockEndOptions(weeklyWindowForSelected, start);
    if (patch.start != null) {
      const endMin = parseHHMMToMinutes(end);
      const startMin = parseHHMMToMinutes(start);
      if (endMin == null || startMin == null || endMin <= startMin || !endOpts.includes(end)) {
        end = endOpts[0] ?? weeklyWindowForSelected.end;
      }
    } else if (patch.end != null && !endOpts.includes(end)) {
      end = endOpts[endOpts.length - 1] ?? weeklyWindowForSelected.end;
    }

    const next = blockedSlotsForDay.map((s, i) => (i === index ? { start, end } : s));
    commitSlots(next);
  };

  const removeBlockedSlot = (index: number) => {
    const next = blockedSlotsForDay.filter((_, i) => i !== index);
    commitSlots(next);
  };

  const selectedDayEvents = selectedDateStr
    ? bookingEvents.filter((e) => e.dateStr === selectedDateStr)
    : [];

  const dayBreakdown = useMemo(() => {
    if (!selectedDateStr) return [];
    const evs = bookingEvents.filter((e) => e.dateStr === selectedDateStr);
    return buildDayBreakdownSegments({
      dateStr: selectedDateStr,
      weekly,
      unavailableEntry: unavailableDates[selectedDateStr] as UnavailableDayStored | undefined,
      isOverride: availableDateOverrides.includes(selectedDateStr),
      isAvailableByWeekday: selectedDateAvailableByWeekday,
      bookings: evs.map((e) => ({
        time: e.time,
        label: e.label,
        status: e.status,
        durationMinutes: e.durationMinutes ?? null,
      })),
    });
  }, [selectedDateStr, weekly, unavailableDates, availableDateOverrides, selectedDateAvailableByWeekday, bookingEvents]);

  /** Hide "Open …–…" free segments; keep window, blocks, bookings, template off. */
  const dayBreakdownForDisplay = useMemo(() => dayBreakdown.filter((seg) => seg.kind !== "free"), [dayBreakdown]);

  const maskPhone = (phone?: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return phone;
    const last4 = digits.slice(-4);
    return `***-${last4}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <AvailabilityCalendar
          availability={weeklyScheduleToAvailability(weekly)}
          busyDates={busyDates}
          unavailableDates={unavailableDates}
          availableDateOverrides={availableDateOverrides}
          onDayClick={handleCalendarDayClick}
          availableDayColor={availableDayColor}
          selectedDateStr={selectedDateStr}
          events={bookingEvents}
          size={calendarSize}
          scheduleWindowEndDateStr={scheduleWindowEndDateStr}
          onNavigateBeyondScheduleWindow={onNavigateBeyondScheduleWindow}
        />
        {selectedDateStr && (
          <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selectedDateStr}</span>
            <span className="text-muted-foreground"> - </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dayIsAvailable}
                onChange={(e) => {
                  if (e.target.checked) markSelectedDateAvailable();
                  else markSelectedDateUnavailable();
                }}
              />
              <span className="text-sm font-medium">
                {t.dashboard?.availableOnThisDay ?? "Available on this day"}
              </span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDateStr(null)}>
              {t.common?.cancel ?? "Cancel"}
            </Button>
          </div>
        )}

        {selectedDateStr && wholeDayOff ? (
          <div className="mt-3 space-y-1.5 max-w-md">
            <Label className="text-xs text-muted-foreground">
              {t.dashboard?.unavailableDayNoteLabel ?? "Reason for blocking this day (optional)"}
            </Label>
            <Input
              value={localUnavailableNote}
              onChange={(e) => setLocalUnavailableNote(e.target.value)}
              onBlur={() => persistUnavailableNote()}
              placeholder={t.dashboard?.unavailableDayNotePlaceholder ?? "e.g. Holiday"}
              className="text-sm"
            />
          </div>
        ) : null}

        {selectedDateStr && canEditDayBlocks ? (
          <div className="mt-3 space-y-3 rounded-lg border border-border bg-card p-4 max-w-lg">
            <div>
              <h5 className="font-semibold text-foreground text-sm">
                {t.dashboard?.scheduleBlockedHoursTitle ?? "Blocked hours on this day"}
              </h5>
            </div>
            {invalidSlotRange ? (
              <p className="text-xs text-destructive font-medium">
                {t.dashboard?.scheduleBlocksInvalidRange ?? "Each block needs an end time after the start time."}
              </p>
            ) : null}
            {blockedSlotsOverlap ? (
              <p className="text-xs text-destructive font-medium">
                {t.dashboard?.scheduleBlocksOverlap ?? "Two or more blocks overlap. Adjust the times."}
              </p>
            ) : null}
            <div className="space-y-2">
              {blockedSlotsForDay.map((slot, idx) => {
                const startOpts = weeklyWindowForSelected
                  ? getBlockStartOptions(weeklyWindowForSelected)
                  : HOUR_OPTIONS;
                const displayStart = startOpts.includes(slot.start) ? slot.start : (startOpts[0] ?? slot.start);
                const endOpts = weeklyWindowForSelected
                  ? getBlockEndOptions(weeklyWindowForSelected, displayStart)
                  : HOUR_OPTIONS;
                const displayEnd = endOpts.includes(slot.end) ? slot.end : (endOpts[0] ?? slot.end);
                return (
                <div key={`${idx}-${slot.start}-${slot.end}`} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1 min-w-[7rem]">
                    <span className="text-xs text-muted-foreground block">{t.dashboard?.scheduleBlockStart ?? "From"}</span>
                    <select
                      value={displayStart}
                      onChange={(e) => updateBlockedSlot(idx, { start: e.target.value })}
                      className="w-full flex h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    >
                      {startOpts.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 min-w-[7rem]">
                    <span className="text-xs text-muted-foreground block">{t.dashboard?.scheduleBlockEnd ?? "To"}</span>
                    <select
                      value={displayEnd}
                      onChange={(e) => updateBlockedSlot(idx, { end: e.target.value })}
                      className="w-full flex h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    >
                      {endOpts.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeBlockedSlot(idx)}
                    aria-label={t.dashboard?.scheduleRemoveBlock ?? "Remove block"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={() => addBlockedSlot()}>
                <Plus className="h-4 w-4" />
                {t.dashboard?.scheduleAddBlock ?? "Add blocked hours"}
              </Button>
              {onSaveBlockedHours ? (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1"
                  onClick={() => void onSaveBlockedHours()}
                  disabled={savingBlockedHours}
                >
                  {savingBlockedHours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t.dashboard?.scheduleSaveBlockedHours ?? "Save blocked hours"}
                </Button>
              ) : null}
            </div>
            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <Label className="text-xs text-muted-foreground">
                {t.dashboard?.scheduleClientMessageLabel ?? "Message to clients (optional)"}
              </Label>
              <Textarea
                value={localUnavailableNote}
                onChange={(e) => setLocalUnavailableNote(e.target.value)}
                onBlur={() => persistSlotClientNote()}
                placeholder={t.dashboard?.scheduleClientMessagePlaceholder ?? "e.g. Closed for appointments 12–2; emergency jobs only."}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
        ) : null}

        {selectedDateStr && dayBreakdownForDisplay.length > 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-card p-3">
            <h5 className="font-semibold text-foreground mb-2 text-sm">
              {t.dashboard?.dayOverviewTitle ?? "Day overview"}
            </h5>
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
              {dayBreakdownForDisplay.map((seg, i) => (
                <li key={i} className="text-foreground/90">
                  {formatBreakdownLine(seg, t.dashboard)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {selectedDateStr && selectedDayEvents.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card p-3">
            <h5 className="font-semibold text-foreground mb-2 text-sm">
              {(t.dashboard?.appointmentsOnDateTitle ?? "Appointments on {{date}}").replace("{{date}}", selectedDateStr)}
            </h5>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {selectedDayEvents
                .slice()
                .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                .map((ev, idx) => (
                  <div key={`${ev.dateStr}-${idx}`} className="rounded-md border border-border/50 bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{ev.label}</div>
                      <div className="text-sm text-muted-foreground">{ev.time ? `Start: ${ev.time}` : "Start:  - "}</div>
                    </div>
                    <div className="mt-1 text-sm space-y-0.5">
                      <div className="text-muted-foreground">Email: {ev.email ? ev.email : "-"}</div>
                      <div className="text-muted-foreground">Phone: {maskPhone(ev.phone) ?? "-"}</div>
                    </div>
                    {ev.status && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {(t.dashboard?.statusLabel ?? "Status")}: {ev.status}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h4 className="font-medium text-foreground mb-3">{t.dashboard?.weeklyTemplate ?? "Weekly template"}</h4>
        <div className="rounded-lg border bg-card p-3 sm:p-4 overflow-x-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-7 min-w-0 sm:min-w-[280px]">
            {WEEKDAY_KEYS.map((key) => (
              <div key={key} className="space-y-2 min-w-0 rounded-md border border-border/60 bg-background/40 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="flex items-center justify-between gap-3 sm:block sm:space-y-2">
                  <Label className="text-sm font-medium text-foreground">{t.createPro[WEEKDAY_LABELS[key]]}</Label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={weekly[key].available}
                      onCheckedChange={(v) => updateDay(key, { available: v === true })}
                    />
                    <span className="text-xs text-muted-foreground">{t.createPro.availableLabel}</span>
                  </label>
                </div>
                {weekly[key].available && (
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">{t.dashboard?.from ?? "From"}</span>
                      <select
                        value={weekly[key].start}
                        onChange={(e) => updateDay(key, { start: e.target.value })}
                        className="w-full flex h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      >
                        {HOUR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground block">{t.dashboard?.to ?? "To"}</span>
                      <select
                        value={weekly[key].end}
                        onChange={(e) => updateDay(key, { end: e.target.value })}
                        className="w-full flex h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      >
                        {HOUR_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
