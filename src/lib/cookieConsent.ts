import type { CookieCategory } from "@/config/legalConfig";

const STORAGE_KEY = "premiere-cookie-consent-v2";
const LEGACY_KEY = "premiere-cookie-consent";

export type CookieConsentState = Record<CookieCategory, boolean> & {
  updatedAt: string;
  version: 2;
};

const DEFAULT_REFUSED: Omit<CookieConsentState, "updatedAt" | "version"> = {
  necessary: true,
  preferences: true,
  analytics: false,
  marketing: false,
};

export function getCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CookieConsentState;
      if (parsed?.version === 2) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "accepted") {
      return {
        necessary: true,
        preferences: true,
        analytics: true,
        marketing: true,
        updatedAt: new Date().toISOString(),
        version: 2,
      };
    }
    if (legacy === "declined") {
      return { ...DEFAULT_REFUSED, updatedAt: new Date().toISOString(), version: 2 };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setCookieConsent(
  partial: Partial<Record<CookieCategory, boolean>>,
): CookieConsentState {
  const next: CookieConsentState = {
    necessary: true,
    preferences: partial.preferences ?? true,
    analytics: !!partial.analytics,
    marketing: !!partial.marketing,
    updatedAt: new Date().toISOString(),
    version: 2,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(LEGACY_KEY, next.analytics || next.marketing ? "accepted" : "declined");
  window.dispatchEvent(new CustomEvent("premiere-cookie-consent", { detail: next }));
  return next;
}

export function hasCookieDecision(): boolean {
  return getCookieConsent() != null;
}

/** Analytics/marketing scripts must call this before loading. */
export function isCookieAllowed(category: Exclude<CookieCategory, "necessary">): boolean {
  const c = getCookieConsent();
  if (!c) return false;
  return !!c[category];
}
