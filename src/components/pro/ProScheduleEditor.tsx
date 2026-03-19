import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { WEEKDAY_KEYS, type WeekdayKey } from "@/i18n/constants";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CalendarX, CalendarCheck } from "lucide-react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import type { UnavailableDatesMap } from "./AvailabilityCalendar";

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
  }[];
  /** Use larger calendar (e.g. in booking history view). */
  calendarSize?: "default" | "large";
  /** When true, calendar only shows current month; month arrows trigger onMonthChangeBlocked. */
  restrictToCurrentMonth?: boolean;
  /** Called when user tries to change month while restrictToCurrentMonth is true. */
  onMonthChangeBlocked?: () => void;
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
  restrictToCurrentMonth = false,
  onMonthChangeBlocked,
}: ProScheduleEditorProps) {
  const { t } = useLanguage();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedDateAvailableByWeekday, setSelectedDateAvailableByWeekday] = useState<boolean>(true);

  const updateDay = (key: WeekdayKey, patch: Partial<WeekdaySchedule>) => {
    onWeeklyChange({
      ...weekly,
      [key]: { ...weekly[key], ...patch },
    });
  };

  const addUnavailableDate = (dateStr: string) => {
    if (!dateStr) return;
    onUnavailableDatesChange({ ...unavailableDates, [dateStr]: true });
    setSelectedDateStr(null);
  };

  const removeUnavailableDate = (dateStr: string) => {
    const next = { ...unavailableDates };
    delete next[dateStr];
    onUnavailableDatesChange(next);
    setSelectedDateStr(null);
  };

  const addAvailableOverride = (dateStr: string) => {
    if (!dateStr || availableDateOverrides.includes(dateStr)) return;
    onAvailableDateOverridesChange([...availableDateOverrides, dateStr].sort());
    setSelectedDateStr(null);
  };

  const removeAvailableOverride = (dateStr: string) => {
    onAvailableDateOverridesChange(availableDateOverrides.filter((d) => d !== dateStr));
    setSelectedDateStr(null);
  };

  const handleCalendarDayClick = (dateStr: string, isAvailableByWeekday: boolean) => {
    setSelectedDateStr(dateStr);
    setSelectedDateAvailableByWeekday(isAvailableByWeekday);
  };

  const isUnavailable = selectedDateStr ? selectedDateStr in unavailableDates : false;
  const isOverride = selectedDateStr ? availableDateOverrides.includes(selectedDateStr) : false;
  const dayIsAvailable = selectedDateStr ? (isOverride ? true : !isUnavailable && selectedDateAvailableByWeekday) : false;

  const markSelectedDateUnavailable = () => {
    if (!selectedDateStr) return;
    onUnavailableDatesChange({ ...unavailableDates, [selectedDateStr]: true });
    onAvailableDateOverridesChange(availableDateOverrides.filter((d) => d !== selectedDateStr));
  };

  const markSelectedDateAvailable = () => {
    if (!selectedDateStr) return;
    const nextUnavailable = { ...unavailableDates };
    delete nextUnavailable[selectedDateStr];

    const nextOverrides = selectedDateAvailableByWeekday
      ? availableDateOverrides.filter((d) => d !== selectedDateStr)
      : [...availableDateOverrides, selectedDateStr].sort();

    onUnavailableDatesChange(nextUnavailable);
    onAvailableDateOverridesChange(nextOverrides);
  };

  const selectedDayEvents = selectedDateStr
    ? bookingEvents.filter((e) => e.dateStr === selectedDateStr)
    : [];

  const maskPhone = (phone?: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return phone;
    const last4 = digits.slice(-4);
    return `***-${last4}`;
  };

  return (
    <div className="space-y-6">
      {/* 1) Preview + interactive calendar first */}
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          {t.dashboard?.scheduleCalendarHint ?? "Preview: your availability and specific dates below."}
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          {t.dashboard?.clickDateToSetHint ?? "Click a date to mark it as unavailable or as an available override."}
        </p>
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
          restrictToCurrentMonth={restrictToCurrentMonth}
          onMonthChangeBlocked={onMonthChangeBlocked}
        />
        {selectedDateStr && (
          <div className="mt-3 p-3 rounded-lg border border-border bg-muted/30 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{selectedDateStr}</span>
            <span className="text-muted-foreground">—</span>
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
                {dayIsAvailable ? (t.dashboard?.availableOnThisDate ?? "Available on this date") : (t.dashboard?.unavailableOnThisDate ?? "Unavailable on this date")}
              </span>
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDateStr(null)}>
              {t.common?.cancel ?? "Cancel"}
            </Button>
          </div>
        )}

        {selectedDateStr && selectedDayEvents.length > 0 && (
          <div className="mt-3 rounded-lg border border-border bg-card p-3">
            <h5 className="font-semibold text-foreground mb-2 text-sm">
              Appointments on {selectedDateStr}
            </h5>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {selectedDayEvents
                .slice()
                .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
                .map((ev, idx) => (
                  <div key={`${ev.dateStr}-${idx}`} className="rounded-md border border-border/50 bg-muted/20 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{ev.label}</div>
                      <div className="text-sm text-muted-foreground">{ev.time ? `Start: ${ev.time}` : "Start: —"}</div>
                    </div>
                    <div className="mt-1 text-sm space-y-0.5">
                      <div className="text-muted-foreground">
                        Address: {ev.address ? ev.address : "—"}
                      </div>
                      <div className="text-muted-foreground">
                    Email: {ev.email ? ev.email : "—"}
                      </div>
                      <div className="text-muted-foreground">
                        Phone: {maskPhone(ev.phone) ?? "—"}
                      </div>
                    </div>
                    {ev.status && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Status: {ev.status}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Weekly template with hour dropdowns */}
      <div>
        <h4 className="font-medium text-foreground mb-2">{t.dashboard?.weeklyTemplate ?? "Weekly template"}</h4>
        <p className="text-sm text-muted-foreground mb-3">
          {t.dashboard?.weeklyTemplateHint ?? "Set which days you're available and your hours (e.g. 9:00–17:00)."}
        </p>
        <div className="rounded-lg border bg-card p-4 overflow-x-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 min-w-[280px]">
            {WEEKDAY_KEYS.map((key) => (
              <div key={key} className="space-y-2 min-w-0">
                <Label className="text-sm font-medium text-foreground">{t.createPro[WEEKDAY_LABELS[key]]}</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={weekly[key].available}
                    onCheckedChange={(v) => updateDay(key, { available: v === true })}
                  />
                  <span className="text-xs text-muted-foreground">{t.createPro.availableLabel}</span>
                </label>
                {weekly[key].available && (
                  <div className="flex flex-col gap-2">
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
