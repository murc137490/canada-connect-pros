/** Normalize North American phone input to E.164 (+1…). */
export function toE164NorthAmerica(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+") && digits.length >= 11) return `+${digits}`;
  return null;
}
