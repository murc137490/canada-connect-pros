/** Example postal code for form placeholders (not stored as a default). */
export const CANADIAN_POSTAL_PLACEHOLDER = "A1B 2C3";

/** Format Canadian postal code as A1A 1A1 while typing (e.g. A1B2C3 → A1B 2C3). */
export function formatCanadianPostal(value: string): string {
  const raw = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  if (raw.length <= 3) return raw;
  return `${raw.slice(0, 3)} ${raw.slice(3)}`;
}

/** Normalized for DB / geocode (uppercase, single space in the middle). */
export function normalizeCanadianPostal(value: string): string {
  return formatCanadianPostal(value.trim());
}
