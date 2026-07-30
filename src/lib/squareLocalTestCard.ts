/** In-app test PAN (π digits) — only used by the dev-only panel next to Square; never sent to Square APIs. */
export const SQUARE_LOCAL_TEST_PAN_DIGITS = "314159265358979";
export const SQUARE_LOCAL_TEST_CVV = "111";
/** Expected expiry as MMYY after normalization (January 2027). */
export const SQUARE_LOCAL_TEST_EXP_MMYY = "0127";

export function normalizePanInput(s: string): string {
  return s.replace(/\D/g, "");
}

/** Normalizes to MMYY: accepts `01/27`, `1/27`, `0127`. */
export function normalizeExpInput(s: string): string {
  const t = s.trim();
  const slash = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(t);
  if (slash) {
    const mm = slash[1].padStart(2, "0");
    const y = slash[2];
    const yy = y.length === 4 ? y.slice(2) : y;
    return `${mm}${yy}`;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits;
}

export function matchesLocalSquareTestCredentials(pan: string, cvv: string, exp: string): boolean {
  return (
    normalizePanInput(pan) === SQUARE_LOCAL_TEST_PAN_DIGITS &&
    cvv.trim() === SQUARE_LOCAL_TEST_CVV &&
    normalizeExpInput(exp) === SQUARE_LOCAL_TEST_EXP_MMYY
  );
}

/** Dev builds only — production bundles never show the local test panel. */
export function showSquareLocalTestPanel(): boolean {
  return import.meta.env.DEV === true;
}
