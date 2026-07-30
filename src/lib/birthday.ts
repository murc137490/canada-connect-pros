/** User must be at least this many years old (account birthday). */
export const MIN_ACCOUNT_AGE_YEARS = 18;

export function maxBirthdayForMinAge(years = MIN_ACCOUNT_AGE_YEARS): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

export function isBirthdayAtLeastMinAge(isoDate: string, years = MIN_ACCOUNT_AGE_YEARS): boolean {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const birth = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return birth <= cutoff;
}
