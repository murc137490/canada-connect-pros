import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { isWholeDayUnavailable, type UnavailableDayStored } from "@/lib/unavailableDates";

/** @deprecated use t.dashboard when rendering (locale). Kept for optional prop fallbacks. */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
      /* JSON schedule: never fall through to text heuristics (keys like "mon" would mark weekdays available). */
      return set;
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
  return set;
}

export type { UnavailableDatesMap, UnavailableDayStored } from "@/lib/unavailableDates";

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
  /** @deprecated Use scheduleWindowEndDateStr. When true, only the current month is viewable. */
  restrictToCurrentMonth?: boolean;
  /** @deprecated */
  onMonthChangeBlocked?: () => void;
  /**
   * Starter (rolling window): YYYY-MM-DD of the last included day. Days after are disabled; nav past the window calls onNavigateBeyondScheduleWindow.
   */
  scheduleWindowEndDateStr?: string;
  /** Past window: month navigation, month picker, or clicking a day after scheduleWindowEndDateStr. */
  onNavigateBeyondScheduleWindow?: () => void;
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
  monthNames: monthNamesProp,
  weekDayLabels: weekDayLabelsProp,
  onDayClick,
  unavailableDates = {},
  availableDateOverrides = [],
  availableDayColor,
  arrowsWhite = false,
  events = [],
  size = "default",
  restrictToCurrentMonth = false,
  onMonthChangeBlocked,
  scheduleWindowEndDateStr,
  onNavigateBeyondScheduleWindow,
  minBookingDate,
  selectedDateStr = null,
}: AvailabilityCalendarProps) {
  const { t } = useLanguage();
  const monthNames = (monthNamesProp ?? t.dashboard.calendarMonthNames) as readonly string[];
  const weekDayLabels = (weekDayLabelsProp ?? t.dashboard.calendarWeekdayShort) as readonly string[];
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
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(() => viewDate.getFullYear());
  const [draftMonth, setDraftMonth] = useState(() => viewDate.getMonth());
  const monthColRef = useRef<HTMLDivElement>(null);
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

  const endStr = scheduleWindowEndDateStr?.trim() || null;

  const tryGoTo = (y: number, m0: number) => {
    if (restrictToCurrentMonth) {
      onMonthChangeBlocked?.();
      return;
    }
    const firstYmd = ymdFromDate(new Date(y, m0, 1));
    if (endStr && firstYmd > endStr) {
      onNavigateBeyondScheduleWindow?.();
      return;
    }
    setViewDate(new Date(y, m0, 1));
    setMonthPickerOpen(false);
  };

  const prevMonth = () => {
    if (restrictToCurrentMonth) {
      onMonthChangeBlocked?.();
      return;
    }
    const p = new Date(year, month - 1, 1);
    tryGoTo(p.getFullYear(), p.getMonth());
  };
  const nextMonth = () => {
    if (restrictToCurrentMonth) {
      onMonthChangeBlocked?.();
      return;
    }
    const n = new Date(year, month + 1, 1);
    tryGoTo(n.getFullYear(), n.getMonth());
  };

  const nowY = new Date().getFullYear();
  const yearMin = Math.min(viewDate.getFullYear() - 5, nowY - 1);
  const yearMax = endStr ? Math.max(parseInt(endStr.slice(0, 4), 10), nowY + 1) : nowY + 3;
  const yearOptions: number[] = [];
  for (let y = yearMin; y <= yearMax; y++) yearOptions.push(y);

  useEffect(() => {
    if (!monthPickerOpen) return;
    setDraftYear(viewDate.getFullYear());
    setDraftMonth(viewDate.getMonth());
  }, [monthPickerOpen, viewDate]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const raf = requestAnimationFrame(() => {
      const col = monthColRef.current;
      if (!col) return;
      const el = col.querySelector<HTMLElement>(`[data-monthidx="${draftMonth}"]`);
      el?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(raf);
  }, [monthPickerOpen, draftYear, draftMonth]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const w = (e: WheelEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).scrollTop += e.deltaY * 6;
    };
    let target: HTMLDivElement | null = null;
    const raf = requestAnimationFrame(() => {
      target = monthColRef.current;
      target?.addEventListener("wheel", w, { passive: false });
    });
    return () => {
      cancelAnimationFrame(raf);
      target?.removeEventListener("wheel", w);
    };
  }, [monthPickerOpen]);

  const days: {
    date: number;
    weekday: number;
    isAvailableByWeekday: boolean;
    isAvailable: boolean;
    isBusy: boolean;
    dateStr: string;
    isPast?: boolean;
    isBeyondWindow?: boolean;
  }[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push({ date: 0, weekday: i, isAvailableByWeekday: false, isAvailable: false, isBusy: false, dateStr: "", isBeyondWindow: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(year, month, d).getDay();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = !!minBookingDate && dateStr < minBookingDate;
    const isBeyondWindow = !!(endStr && dateStr > endStr);
    const isAvailableByWeekday = availableDays.has(weekday);
    const hasOverride = overridesSet.has(dateStr);
    const unavailEntry = unavailableDates[dateStr] as UnavailableDayStored | undefined;
    const wholeDayUnavail = unavailEntry != null && isWholeDayUnavailable(unavailEntry);
    const isAvailable = isPast || isBeyondWindow ? false : hasOverride ? true : wholeDayUnavail ? false : isAvailableByWeekday;
    const isBusy = busySet.has(dateStr);
    days.push({
      date: d,
      weekday,
      isAvailableByWeekday: isAvailableByWeekday && !isPast && !isBeyondWindow,
      isAvailable,
      isBusy,
      dateStr,
      isPast,
      isBeyondWindow,
    });
  }

  return (
    <div className={cn("rounded-xl border bg-card p-2 sm:p-4", isLarge && "p-2 sm:p-5", className)}>
      <div className={cn("flex items-center justify-between gap-1 mb-3", arrowsWhite && "rounded-lg bg-gray-700 px-2 py-1.5", isLarge && "mb-4")}>
        <Button type="button" variant="ghost" size="icon" onClick={prevMonth} className={cn("h-8 w-8 shrink-0", isLarge && "h-10 w-10", arrowsWhite && "text-white hover:bg-white/20 hover:text-white")}>
          <ChevronLeft size={isLarge ? 20 : 16} />
        </Button>
        {restrictToCurrentMonth ? (
          <span className={cn("text-sm font-medium min-w-0 text-center", isLarge && "text-base", arrowsWhite && "text-white")}>
            {monthNames[month]} {year}
          </span>
        ) : (
          <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto min-w-0 flex-1 gap-1.5 px-2 py-1 font-medium rounded-md",
                  isLarge ? "text-base" : "text-sm",
                  arrowsWhite && "text-white hover:bg-white/15 hover:text-white",
                )}
                aria-label={t.dashboard?.calendarOpenMonthPicker ?? "Choose month and year"}
              >
                <CalendarDays className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">
                  {monthNames[month]} {year}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(20rem,calc(100vw-1.5rem))] p-3" align="center">
              <p className="text-xs text-muted-foreground mb-2">{t.dashboard?.calendarGoToTitle ?? "Go to month"}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex flex-col gap-1 min-w-[7rem]">
                  <span className="text-xs font-medium text-foreground">{t.dashboard?.calendarYearLabel ?? "Year"}</span>
                  <select
                    value={draftYear}
                    onChange={(e) => setDraftYear(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground w-full"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground">{t.dashboard?.calendarMonthLabel ?? "Month"}</span>
                  <div
                    ref={monthColRef}
                    className="max-h-64 overflow-y-auto overscroll-y-contain touch-pan-y snap-y snap-mandatory rounded-md border border-input bg-muted/30 py-1 scroll-smooth [scrollbar-gutter:stable] [scroll-behavior:smooth]"
                  >
                    {monthNames.map((name, mIdx) => (
                      <button
                        key={mIdx}
                        type="button"
                        data-monthidx={mIdx}
                        onClick={() => {
                          setDraftMonth(mIdx);
                          tryGoTo(draftYear, mIdx);
                        }}
                        className={cn(
                          "w-full min-h-8 px-2 py-1.5 text-left text-sm snap-center snap-always",
                          mIdx === draftMonth ? "bg-primary/15 font-semibold text-foreground" : "hover:bg-muted/80 text-foreground/90",
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                className="w-full mt-3"
                onClick={() => tryGoTo(draftYear, draftMonth)}
              >
                {t.dashboard?.calendarShowMonth ?? "Show"}
              </Button>
            </PopoverContent>
          </Popover>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={nextMonth} className={cn("h-8 w-8 shrink-0", isLarge && "h-10 w-10", arrowsWhite && "text-white hover:bg-white/20 hover:text-white")}>
          <ChevronRight size={isLarge ? 20 : 16} />
        </Button>
      </div>
      <div>
        <div className={cn("grid w-full grid-cols-7 gap-0.5 text-center", isLarge && "gap-1 sm:gap-1")}>
          {weekDayLabels.map((label) => (
            <div key={label} className={cn("text-xs font-medium text-muted-foreground py-1", isLarge && "text-sm py-2")}>
              {label}
            </div>
          ))}
          {days.map((day, i) => {
            const isBeyond = !!(onDayClick && day.date && day.isBeyondWindow);
            const isInteractiveEdit = !!(onDayClick && day.date && !day.isPast && !isBeyond);
            const isInteractiveUpgrade = isBeyond;
            const Cell = isInteractiveEdit || isInteractiveUpgrade ? "button" : "div";
            const isAvailable = day.date && day.isAvailable && !day.isBusy;
            const isUnavailable = day.date && (day.isPast || !day.isAvailable || day.isBusy);
            const isToday = day.dateStr === todayStr;
            const isSelected = selectedDateStr ? day.dateStr === selectedDateStr : false;
            const dayEvents = day.dateStr ? (eventsByDate[day.dateStr] || []) : [];
            return (
              <Cell
                key={i}
                type={Cell === "button" ? "button" : undefined}
                onClick={
                  Cell === "button"
                    ? isInteractiveEdit
                      ? () => onDayClick!(day.dateStr, day.isAvailableByWeekday)
                      : isInteractiveUpgrade
                        ? () => onNavigateBeyondScheduleWindow?.()
                        : undefined
                    : undefined
                }
                className={cn(
                  "flex flex-col items-center justify-start rounded text-sm font-medium min-h-[2rem] relative",
                  isLarge ? "aspect-square w-full justify-center p-0.5 sm:aspect-auto sm:min-h-[4.5rem] sm:justify-start sm:py-1.5 sm:px-0.5" : "h-8 justify-center",
                  isInteractiveEdit && "cursor-pointer hover:ring-2 hover:ring-offset-1 ring-primary",
                  isInteractiveUpgrade && "cursor-pointer opacity-70 hover:ring-1 hover:ring-amber-500/50",
                  !day.date && "invisible",
                  isAvailable && !availableDayColor && "bg-primary text-primary-foreground border border-primary/30 shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]",
                  isUnavailable && "bg-slate-300/80 dark:bg-slate-600/90 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-500",
                  isBeyond && "line-through opacity-60",
                  isToday && "ring-2 ring-offset-1 ring-amber-500 dark:ring-amber-400 font-semibold shadow-[0_0_0_2px_rgba(245,158,11,0.5)]",
                  // Calendar "selected day" outline: white in dark mode, black in light mode.
                  isSelected && "ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-background"
                )}
                style={isAvailable && availableDayColor ? { backgroundColor: availableDayColor, color: "#fff", border: "0.5px solid rgba(255,255,255,0.4)", boxShadow: isToday ? "0 0 0 2px rgba(245,158,11,0.6)" : "none" } : undefined}
              >
                <span className={isLarge ? "text-base font-semibold" : ""}>{day.date || ""}</span>
                {isLarge && dayEvents.length > 0 && (
                  <div className="hidden w-full mt-1 space-y-0.5 overflow-hidden sm:block">
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
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className={cn("w-4 h-4 rounded border-[0.5px] border-primary/30", !availableDayColor && "bg-primary")}
            style={availableDayColor ? { backgroundColor: availableDayColor, border: "0.5px solid rgba(255,255,255,0.4)" } : undefined}
          />
          <span className="text-foreground font-medium">{t.dashboard.calendarLegendAvailable}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-slate-300 dark:border-slate-500 bg-slate-300/80 dark:bg-slate-600/90" />
          <span className="text-muted-foreground">{t.dashboard.calendarLegendUnavailable}</span>
        </span>
      </div>
    </div>
  );
}
