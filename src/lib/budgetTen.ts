/** Snap dollar amount to nearest $10 (non-negative). */
export function snapBudgetToTen(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (Number.isNaN(n) || n < 0) return "";
  return String(Math.round(n / 10) * 10);
}
