/** Urgency presets for job requests */
export const TIMING_OPTIONS = [
  { value: "asap", labelKey: "timingAsap" as const },
  { value: "few_days", labelKey: "timingFewDays" as const },
  { value: "this_week", labelKey: "timingThisWeek" as const },
  { value: "flexible", labelKey: "timingFlexible" as const },
] as const;

/** Time-of-day preference (optional, works with calendar date) */
export const TIME_WINDOW_OPTIONS = [
  { value: "", labelKey: "timeWindowAny" as const },
  { value: "morning", labelKey: "timeWindowMorning" as const },
  { value: "afternoon", labelKey: "timeWindowAfternoon" as const },
  { value: "evening", labelKey: "timeWindowEvening" as const },
  { value: "flexible", labelKey: "timeWindowFlexible" as const },
] as const;
