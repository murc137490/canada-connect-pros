export type UnavailableTimeSlot = { start: string; end: string };

/** Value stored per date in `pro_profiles.unavailable_dates` (JSON). */
export type UnavailableDayStored =
  | true
  | UnavailableTimeSlot[]
  | {
      wholeDay?: boolean;
      note?: string;
      slots?: UnavailableTimeSlot[];
    };

export type UnavailableDatesMap = Record<string, UnavailableDayStored>;

export function isWholeDayUnavailable(val: UnavailableDayStored | undefined): boolean {
  if (val === true) return true;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const o = val as { wholeDay?: boolean; slots?: UnavailableTimeSlot[] };
    if (o.wholeDay) return true;
    if (o.note?.trim() && !o.slots?.length) return true;
  }
  return false;
}

export function getUnavailableSlots(val: UnavailableDayStored | undefined): UnavailableTimeSlot[] {
  if (val === undefined || val === true) return [];
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const o = val as { slots?: UnavailableTimeSlot[] };
    return Array.isArray(o.slots) ? o.slots : [];
  }
  return [];
}

export function getUnavailableNote(val: UnavailableDayStored | undefined): string | undefined {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    const n = (val as { note?: string }).note?.trim();
    return n || undefined;
  }
  return undefined;
}
