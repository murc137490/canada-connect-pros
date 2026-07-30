import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { TIMING_OPTIONS, TIME_WINDOW_OPTIONS } from "@/data/makeRequestForm";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface TimingAndDateFieldsProps {
  timing: string;
  onTimingChange: (value: string) => void;
  preferredDate: Date | undefined;
  onPreferredDateChange: (value: Date | undefined) => void;
  timeWindow: string;
  onTimeWindowChange: (value: string) => void;
  availabilityMode?: "range" | "specific_day" | "exact";
  onAvailabilityModeChange?: (value: "range" | "specific_day" | "exact") => void;
  rangeStartDate?: Date | undefined;
  rangeEndDate?: Date | undefined;
  onRangeDateChange?: (from: Date | undefined, to: Date | undefined) => void;
  startHour?: string;
  onStartHourChange?: (value: string) => void;
  endHour?: string;
  onEndHourChange?: (value: string) => void;
  exactTime?: string;
  onExactTimeChange?: (value: string) => void;
  compact?: boolean;
}

export default function TimingAndDateFields({
  timing,
  onTimingChange,
  preferredDate,
  onPreferredDateChange,
  timeWindow,
  onTimeWindowChange,
  availabilityMode,
  onAvailabilityModeChange,
  rangeStartDate,
  rangeEndDate,
  onRangeDateChange,
  startHour = "",
  onStartHourChange,
  endHour = "",
  onEndHourChange,
  exactTime = "",
  onExactTimeChange,
  compact = false,
}: TimingAndDateFieldsProps) {
  const { t } = useLanguage();
  const mk = t.makeRequest as Record<string, string>;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const usesAvailabilityModes = availabilityMode != null && onAvailabilityModeChange != null;
  const selectedRange: DateRange | undefined =
    rangeStartDate || rangeEndDate ? { from: rangeStartDate, to: rangeEndDate } : undefined;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className="space-y-2">
        <Label className="text-foreground">{mk.step6Label}</Label>
        <div className="space-y-2">
          {TIMING_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer text-foreground">
              <input
                type="radio"
                name="timing-pref"
                value={opt.value}
                checked={timing === opt.value}
                onChange={() => onTimingChange(opt.value)}
                className="rounded-full border-input text-primary"
              />
              <span>{mk[opt.labelKey]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{mk.step6CalendarSection}</p>
        <p className="text-xs text-muted-foreground">{mk.step6CalendarHint}</p>
        {usesAvailabilityModes && (
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { value: "range", label: mk.step6RangeOption ?? "Flexible range" },
              { value: "specific_day", label: mk.step6SpecificDayOption ?? "Specific day" },
              { value: "exact", label: mk.step6ExactOption ?? "Set date & time" },
            ].map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm text-foreground",
                  availabilityMode === opt.value ? "border-primary bg-primary/10" : "border-border bg-background"
                )}
              >
                <input
                  type="radio"
                  name="availability-mode"
                  value={opt.value}
                  checked={availabilityMode === opt.value}
                  onChange={() => onAvailabilityModeChange(opt.value as "range" | "specific_day" | "exact")}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {usesAvailabilityModes && availabilityMode === "range" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-foreground text-xs">{mk.step6DateRange ?? "From day to day"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal text-foreground",
                      compact ? "w-full" : "",
                      !rangeStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeStartDate
                      ? `${format(rangeStartDate, "PPP")}${rangeEndDate ? ` - ${format(rangeEndDate, "PPP")}` : ""}`
                      : mk.step6PickRangePlaceholder ?? "Select a date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={selectedRange}
                    onSelect={(range) => onRangeDateChange?.(range?.from, range?.to)}
                    disabled={(date) => date < today}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ) : null}

        {usesAvailabilityModes && availabilityMode === "exact" ? (
          <div className={cn("flex gap-3", compact ? "flex-col" : "flex-col sm:flex-row sm:items-end")}>
            <div
              className={cn(
                "flex min-w-0",
                compact ? "w-full flex-col gap-2" : "flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              )}
            >
              <Label className={cn("text-foreground text-xs shrink-0", !compact && "pt-0 sm:pt-2")}>{mk.step6PickDate}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal text-foreground",
                      compact ? "w-full" : "w-full sm:ml-2 sm:w-auto sm:shrink-0",
                      !preferredDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preferredDate ? format(preferredDate, "PPP") : mk.step6PickDatePlaceholder}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={preferredDate}
                    onSelect={onPreferredDateChange}
                    disabled={(date) => date < today}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className={cn("space-y-1.5", compact ? "w-full" : "")}>
              <Label htmlFor="exact-time" className="text-foreground text-xs">
                {mk.step6ExactTime ?? "Exact time"}
              </Label>
              <input
                id="exact-time"
                type="time"
                step={3600}
                value={exactTime}
                onChange={(e) => onExactTimeChange?.(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        ) : null}

        {(!usesAvailabilityModes || availabilityMode === "specific_day") && (
        <div
          className={cn(
            "flex gap-3",
            compact ? "flex-col" : "flex-col sm:flex-row sm:items-end"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1",
              compact ? "w-full flex-col gap-2" : "flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            )}
          >
            <Label className={cn("text-foreground text-xs shrink-0", !compact && "pt-0 sm:pt-2")}>{mk.step6PickDate}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal text-foreground",
                    compact ? "w-full" : "w-full sm:ml-2 sm:w-auto sm:shrink-0",
                    !preferredDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {preferredDate ? format(preferredDate, "PPP") : mk.step6PickDatePlaceholder}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={preferredDate}
                  onSelect={onPreferredDateChange}
                  disabled={(date) => date < today}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className={cn("space-y-1.5 flex-1", compact ? "min-w-0 w-full" : "min-w-[140px]")}>
            <Label htmlFor="time-window-select" className="text-foreground text-xs">
              {mk.step6TimeWindow}
            </Label>
            <select
              id="time-window-select"
              value={timeWindow}
              onChange={(e) => {
                const next = e.target.value;
                onTimeWindowChange(next);
                if (next !== "flexible") {
                  onStartHourChange?.("");
                  onEndHourChange?.("");
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {TIME_WINDOW_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {mk[opt.labelKey]}
                </option>
              ))}
            </select>
          </div>
        </div>
        )}
        {usesAvailabilityModes && availabilityMode === "specific_day" && timeWindow === "flexible" ? (
          <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
            <div className="space-y-1.5">
              <Label htmlFor="specific-start-hour" className="text-foreground text-xs">
                {mk.step6AvailableFrom ?? "Available from"}
              </Label>
              <input
                id="specific-start-hour"
                type="time"
                step={3600}
                value={startHour}
                onChange={(e) => onStartHourChange?.(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="specific-end-hour" className="text-foreground text-xs">
                {mk.step6AvailableUntil ?? "Available until"}
              </Label>
              <input
                id="specific-end-hour"
                type="time"
                step={3600}
                value={endHour}
                onChange={(e) => onEndHourChange?.(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        ) : null}
        {preferredDate && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground h-8 px-2" onClick={() => onPreferredDateChange(undefined)}>
            {mk.step6ClearDate}
          </Button>
        )}
      </div>
    </div>
  );
}
