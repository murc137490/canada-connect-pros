/**
 * Canonical site URL for Supabase email actions (confirm signup, password reset).
 *
 * In production, set `VITE_SITE_URL=https://www.altshift.ca` so confirmation
 * links never use localhost. If unset, falls back to the current browser origin (dev).
 */
import { SITE_URL } from "@/config/legalConfig";

export function getPublicSiteOrigin(): string {
  const raw = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || SITE_URL;
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
 * Origin for OAuth redirects.
 * - Localhost / Vercel preview: stay on the current host.
 * - Production: always return to the AltShift canonical URL so auth `?code=`
 *   never keeps people on premierservices.ca (that host also 301s via vercel.json).
 */
export function getOAuthRedirectOrigin(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
    const isPreview = host.endsWith(".vercel.app");
    if (isLocal || isPreview) return window.location.origin;
    // Never OAuth-return on the legacy Première hosts
    if (host === "premiereservices.ca" || host === "www.premiereservices.ca") {
      return getPublicSiteOrigin() || "https://www.altshift.ca";
    }
  }
  return getPublicSiteOrigin() || (typeof window !== "undefined" ? window.location.origin : "");
}
