function hasTenOrMoreDigits(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length >= 10;
}

const EMAILISH = /@[a-z0-9.-]+\.[a-z]{2,}/i;
const URLISH = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|ca|net|org|io|co|app|dev|me|tv|biz|info|fr|qc\.ca))\b/i;

export function getProPublicContactBlacklistReasons(text: string): string[] {
  const raw = text.trim();
  if (!raw) return [];
  const reasons: string[] = [];
  if (EMAILISH.test(raw)) reasons.push("email");
  if (URLISH.test(raw)) reasons.push("link");
  if (hasTenOrMoreDigits(raw)) reasons.push("phone");
  return reasons;
}

export function proPublicContactTextBlocked(text: string): boolean {
  return getProPublicContactBlacklistReasons(text).length > 0;
}
