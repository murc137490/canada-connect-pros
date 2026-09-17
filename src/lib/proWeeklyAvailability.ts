import { WEEKDAY_KEYS, type WeekdayKey } from "@/i18n/constants";

export type WeekdaySchedule = { available: boolean; start: string; end: string };
export type WeeklyScheduleState = Record<WeekdayKey, WeekdaySchedule>;

export const defaultWeeklySchedule = (): WeeklyScheduleState =>
  WEEKDAY_KEYS.reduce((acc, key) => {
    acc[key] = { available: false, start: "09:00", end: "17:00" };
    return acc;
  }, {} as WeeklyScheduleState);

/** Serialize weekly schedule to JSON stored in pro_profiles.availability. */
export function weeklyScheduleToAvailability(weekly: WeeklyScheduleState): string {
  const obj: Record<string, { available: boolean; start?: string; end?: string }> = {};
  WEEKDAY_KEYS.forEach((key) => {
    obj[key] = { available: weekly[key].available, start: weekly[key].start, end: weekly[key].end };
  });
  return JSON.stringify(obj);
}

/** Parse availability string from DB into weekly schedule. Handles JSON and legacy free-text. */
export function parseAvailabilityToWeekly(availability: string | null | undefined): WeeklyScheduleState {
  const defaultState = defaultWeeklySchedule();
  if (!availability?.trim()) return defaultState;
  const s = availability.trim();
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s) as Record<
        string,
        { available?: boolean; morning?: boolean; afternoon?: boolean; evening?: boolean; start?: string; end?: string }
      >;
      WEEKDAY_KEYS.forEach((key) => {
        const day = parsed[key];
        if (!day) return;
        const available = !!day.available || !!(day.morning || day.afternoon || day.evening);
        defaultState[key] = {
          available,
          start: day.start ?? "09:00",
          end: day.end ?? "17:00",
        };
      });
      return defaultState;
    } catch {
      /* fall through to free-text */
    }
  }

  // Legacy free-text (e.g. "Mon–Sat · mornings & afternoons") → same bookable shape as JSON.
  const lower = s.toLowerCase();
  const jsOrder = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  const abbrev = (w: string) => w.slice(0, 3) as (typeof jsOrder)[number];
  const marked = new Set<WeekdayKey>();

  const range = lower.match(
    /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*[-–—]\s*(sun|mon|tue|wed|thu|fri|sat)/,
  );
  if (range) {
    const a = jsOrder.indexOf(abbrev(range[1]));
    const b = jsOrder.indexOf(abbrev(range[2]));
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) marked.add(jsOrder[i]);
    }
  } else {
    if (/\bweekday/.test(lower) || (/\bmon\b/.test(lower) && /\bfri\b/.test(lower))) {
      (["mon", "tue", "wed", "thu", "fri"] as const).forEach((d) => marked.add(d));
    }
    if (/\bevery\s*day\b|\b7\s*days\b|\bdaily\b/.test(lower)) {
      WEEKDAY_KEYS.forEach((d) => marked.add(d));
    }
    for (const key of WEEKDAY_KEYS) {
      if (new RegExp(`\\b${key}`).test(lower)) marked.add(key);
    }
  }

  if (marked.size === 0) return defaultState;

  let start = "09:00";
  let end = "17:00";
  const hasMorning = /\bmorning/.test(lower);
  const hasAfternoon = /\bafternoon/.test(lower);
  const hasEvening = /\bevening/.test(lower);
  if (hasMorning && !hasAfternoon && !hasEvening) {
    start = "08:00";
    end = "12:00";
  } else if (hasAfternoon && !hasMorning && !hasEvening) {
    start = "12:00";
    end = "17:00";
  } else if (hasEvening && !hasMorning && !hasAfternoon) {
    start = "17:00";
    end = "21:00";
  } else if (hasMorning && hasAfternoon && !hasEvening) {
    start = "09:00";
    end = "17:00";
  } else if (hasMorning && hasAfternoon && hasEvening) {
    start = "08:00";
    end = "21:00";
  }

  for (const key of marked) {
    defaultState[key] = { available: true, start, end };
  }
  return defaultState;
}

const WEEKDAY_KEY_TO_JS_INDEX: Record<WeekdayKey, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Weekday indices (0=Sun..6=Sat) that are bookable in the weekly template. */
export function availableWeekdayIndices(availability: string | null | undefined): Set<number> {
  const weekly = parseAvailabilityToWeekly(availability);
  const set = new Set<number>();
  WEEKDAY_KEYS.forEach((key) => {
    if (weekly[key].available) set.add(WEEKDAY_KEY_TO_JS_INDEX[key]);
  });
  return set;
}
