import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const WEEKDAY_TO_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Parse availability string (JSON, key-value, or text) to set of weekday indices 0-6 (Sun-Sat). */
function parseAvailableWeekdays(availability: string | null | undefined): Set<number> {
  const set = new Set<number>();
  if (!availability || !availability.trim()) return set;
  const s = availability.trim().toLowerCase();

  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s) as Record<string, { available?: boolean }>;
      (Object.keys(parsed) as string[]).forEach((key) => {
        const idx = WEEKDAY_TO_INDEX[key];
        if (typeof idx === "number" && parsed[key]?.available) set.add(idx);
      });
      if (set.size > 0) return set;
    } catch {
      /* fall through to text parse */
    }
  }

  if (s.includes("mon") || s.includes("tue") || s.includes("wed") || s.includes("thu") || s.includes("fri")) {
    [1, 2, 3, 4, 5].forEach((d) => set.add(d));
  }
  if (s.includes("sat")) set.add(6);
  if (s.includes("sun")) set.add(0);
  if (s.includes("every day") || s.includes("7 days")) [0, 1, 2, 3, 4, 5, 6].forEach((d) => set.add(d));
  if (set.size === 0) [1, 2, 3, 4, 5].forEach((d) => set.add(d));
  return set;
}

/** For editor: date -> true (whole day off) or array of time slots { start, end } in HH:mm */
export type UnavailableDatesMap = Record<string, true | { start: string; end: string }[]>;

export interface AvailabilityCalendarProps {
  availability: string | null | undefined;
  /** Dates that are busy (e.g. from bookings). Will be greyed out. */
  busyDates?: string[];
  className?: string;
  /** Start the calendar at current month + offset (0 = this month). */
  initialMonthOffset?: number;
  /** Optional translations for month names */
  monthNames?: string[];
  weekDayLabels?: string[];
  /** When set, days are clickable and this is called with dateStr (YYYY-MM-DD) and weekday-based availability */
  onDayClick?: (dateStr: string, isAvailableByWeekday: boolean) => void;
  /** Date-specific unavailability (editor mode) */
  unavailableDates?: UnavailableDatesMap;
  /** Dates when pro is available despite weekday (editor mode) */
  availableDateOverrides?: string[];
  /** Optional: use this color for available days (e.g. pro's Public page appearance primary). Falls back to theme primary. */
  availableDayColor?: string;
  /** When true, month navigation arrows and label use white (for dark header bar). */
  arrowsWhite?: boolean;
  /** Optional: show events (e.g. bookings) on the calendar with label and time per day. */
  events?: { dateStr: string; label: string; time?: string; status?: string }[];
  /** Larger calendar for dashboard booking view. */
  size?: "default" | "large";
  /** When true, only current month is viewable; prev/next call onMonthChangeBlocked instead of changing month. */
  restrictToCurrentMonth?: boolean;
  /** Called when user tries to change month while restrictToCurrentMonth is true. */
  onMonthChangeBlocked?: () => void;
  /** Optional min date for booking (YYYY-MM-DD). Days before this are not clickable and shown as unavailable. */
  minBookingDate?: string;
  /** Optional: highlight the currently selected date in the calendar. */
  selectedDateStr?: string | null;
}

export default function AvailabilityCalendar({
  availability,
  busyDates = [],
  className,
  initialMonthOffset = 0,
  monthNames = MONTHS,
  weekDayLabels = WEEKDAYS,
  onDayClick,
  unavailableDates = {},
  availableDateOverrides = [],
  availableDayColor,
  arrowsWhite = false,
  events = [],
  size = "default",
  restrictToCurrentMonth = false,
  onMonthChangeBlocked,
  minBookingDate,
  selectedDateStr = null,
}: AvailabilityCalendarProps) {
  const eventsByDate = (() => {
    const map: Record<string, { label: string; time?: string; status?: string }[]> = {};
    events.forEach((e) => {
      if (!map[e.dateStr]) map[e.dateStr] = [];
      map[e.dateStr].push({ label: e.label, time: e.time, status: e.status });
    });
    return map;
  })();
  const isLarge = size === "large";
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + initialMonthOffset, 1);
  });
  const availableDays = parseAvailableWeekdays(availability);
  const busySet = new Set(busyDates);
  const overridesSet = new Set(availableDateOverrides);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonth = () => {
    if (restrictToCurrentMonth) {
      onMonthChangeBlocked?.();
      return;
    }
    setViewDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    if (restrictToCurrentMonth) {
      onMonthChangeBlocked?.();
      return;
    }
    setViewDate(new Date(year, month + 1, 1));
  };

  const days: { date: number; weekday: number; isAvailableByWeekday: boolean; isAvailable: boolean; isBusy: boolean; dateStr: string; isPast?: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ date: 0, weekday: i, isAvailableByWeekday: false, isAvailable: false, isBusy: false, dateStr: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(year, month, d).getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = !!minBookingDate && dateStr < minBookingDate;
    const isAvailableByWeekday = availableDays.has(weekday);
    const hasOverride = overridesSet.has(dateStr);
    const hasUnavail = dateStr in unavailableDates;
    const isAvailable = isPast ? false : (hasOverride ? true : hasUnavail ? false : isAvailableByWeekday);
    const isBusy = busySet.has(dateStr);
    days.push({ date: d, weekday, isAvailableByWeekday: isAvailableByWeekday && !isPast, isAvailable, isBusy, dateStr, isPast });
  }

  return (
    <div className={cn("rounded-xl border bg-card p-4", isLarge && "p-5", className)}>
      <div className={cn("flex items-center justify-between mb-3", arrowsWhite && "rounded-lg bg-gray-700 px-2 py-1.5", isLarge && "mb-4")}>
        <Button type="button" variant="ghost" size="icon" onClick={prevMonth} className={cn("h-8 w-8", isLarge && "h-10 w-10", arrowsWhite && "text-white hover:bg-white/20 hover:text-white")}>
          <ChevronLeft size={isLarge ? 20 : 16} />
        </Button>
        <span className={cn("text-sm font-medium", isLarge && "text-base", arrowsWhite && "text-white")}>
          {monthNames[month]} {year}
        </span>
        <Button type="button" variant="ghost" size="icon" onClick={nextMonth} className={cn("h-8 w-8", isLarge && "h-10 w-10", arrowsWhite && "text-white hover:bg-white/20 hover:text-white")}>
          <ChevronRight size={isLarge ? 20 : 16} />
        </Button>
      </div>
      <div className={cn("grid grid-cols-7 gap-0.5 text-center", isLarge && "gap-1")}>
        {weekDayLabels.map((label) => (
          <div key={label} className={cn("text-xs font-medium text-muted-foreground py-1", isLarge && "text-sm py-2")}>
            {label}
          </div>
        ))}
        {days.map((day, i) => {
          const Cell = onDayClick && day.date && !day.isPast ? "button" : "div";
          const isAvailable = day.date && day.isAvailable && !day.isBusy;
          const isUnavailable = day.date && (day.isPast || !day.isAvailable || day.isBusy);
          const isToday = day.dateStr === todayStr;
          const isSelected = selectedDateStr ? day.dateStr === selectedDateStr : false;
          const dayEvents = day.dateStr ? (eventsByDate[day.dateStr] || []) : [];
          return (
            <Cell
              key={i}
              type={Cell === "button" ? "button" : undefined}
              onClick={Cell === "button" ? () => onDayClick(day.dateStr, day.isAvailableByWeekday) : undefined}
              className={cn(
                "flex flex-col items-center justify-start rounded text-sm font-medium min-h-[2rem] relative",
                isLarge ? "min-h-[4.5rem] py-1.5 px-0.5" : "h-8 justify-center",
                Cell === "button" && "cursor-pointer hover:ring-2 hover:ring-offset-1 ring-primary",
                !day.date && "invisible",
                isAvailable && !availableDayColor && "bg-primary text-primary-foreground border border-primary/30 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]",
                isUnavailable && "bg-slate-300/80 dark:bg-slate-600/90 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-500",
                isToday && "ring-2 ring-offset-1 ring-amber-500 dark:ring-amber-400 font-semibold shadow-[0_0_0_2px_rgba(245,158,11,0.5)]",
                // Calendar "selected day" outline: white in dark mode, black in light mode.
                isSelected && "ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-background"
              )}
              style={isAvailable && availableDayColor ? { backgroundColor: availableDayColor, color: "#fff", border: "0.5px solid rgba(255,255,255,0.4)", boxShadow: isToday ? "0 0 0 2px rgba(245,158,11,0.6)" : "none" } : undefined}
            >
              <span className={isLarge ? "text-base font-semibold" : ""}>{day.date || ""}</span>
              {isLarge && dayEvents.length > 0 && (
                <div className="w-full mt-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev, j) => (
                    <div key={j} className="text-[10px] leading-tight truncate rounded bg-foreground/10 dark:bg-foreground/20 px-0.5 py-0.5 text-foreground" title={`${ev.time || ""} ${ev.label}${ev.status ? ` (${ev.status})` : ""}`}>
                      {ev.time && <span className="font-medium">{ev.time}</span>} {ev.label}
                    </div>
                  ))}
                  {dayEvents.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                </div>
              )}
            </Cell>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className={cn("w-4 h-4 rounded border-[0.5px] border-primary/30", !availableDayColor && "bg-primary")}
            style={availableDayColor ? { backgroundColor: availableDayColor, border: "0.5px solid rgba(255,255,255,0.4)" } : undefined}
          />
          <span className="text-foreground font-medium">Available</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-slate-300 dark:border-slate-500 bg-slate-300/80 dark:bg-slate-600/90" />
          <span className="text-muted-foreground">Unavailable / Busy</span>
        </span>
      </div>
    </div>
  );
}
