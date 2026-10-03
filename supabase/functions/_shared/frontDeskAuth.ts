export type FrontDeskLanguage = "en" | "fr" | "es" | "ar";

export function normalizeFrontDeskLanguage(value: unknown): FrontDeskLanguage | null {
  const language = String(value ?? "").trim().toLowerCase();
  return language === "en" || language === "fr" || language === "es" || language === "ar"
    ? language
    : null;
}

/** Telnyx may return HTTP 200 for an unsuccessful verification attempt. */
export function telnyxOtpAccepted(status: number, payload: unknown): boolean {
  if (status < 200 || status >= 300 || !payload || typeof payload !== "object") return false;
  return (payload as { valid?: unknown }).valid === true;
}

/** An invalid explicit ID must not fall back to a caller-ID match. */
export function resolveOtpMemberId(requested: unknown, callerMatched: unknown): string | null {
  const requestedText = String(requested ?? "").trim();
  const requestedDigits = requestedText.replace(/\D/g, "");
  if (requestedText) return /^[0-9]{4}$/.test(requestedDigits) ? requestedDigits : null;

  const matchedDigits = String(callerMatched ?? "").replace(/\D/g, "");
  return /^[0-9]{4}$/.test(matchedDigits) ? matchedDigits : null;
}
