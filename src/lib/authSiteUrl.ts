/**
 * Canonical site URL for Supabase email actions (confirm signup, password reset).
 *
 * In production, set `VITE_SITE_URL=https://www.premiereservices.ca` so confirmation
 * links never use localhost. If unset, falls back to the current browser origin (dev).
 */
export function getPublicSiteOrigin(): string {
  const raw = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() ?? "";
  if (raw) {
    try {
      return new URL(raw.includes("://") ? raw : `https://${raw}`).origin;
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * Origin for OAuth redirects. Prefer the live browser origin so Google/Supabase
 * return to the same host the user started on (www vs apex, localhost vs prod).
 * Falls back to VITE_SITE_URL when window is unavailable.
 */
export function getOAuthRedirectOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return getPublicSiteOrigin();
}
