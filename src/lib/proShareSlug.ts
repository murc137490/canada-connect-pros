import { SITE_URL } from "@/config/legalConfig";

/** Path segments that must never be used as pro vanity URLs. */
export const RESERVED_SHARE_SLUGS = new Set([
  "admin",
  "auth",
  "cookies",
  "cookie-policy",
  "confirm-deletion",
  "create-pro-account",
  "dashboard",
  "help",
  "join-pros",
  "make-request",
  "pay",
  "phone-preview",
  "privacy",
  "privacy-policy",
  "pro-onboarding",
  "pro-plans",
  "pros",
  "reset-password",
  "services",
  "support",
  "terms",
  "www",
  "api",
  "static",
  "assets",
]);

/** Normalize a business / person name into a URL slug: "Aymen Services" → "aymenservices". */
export function slugifyShareName(raw: string): string {
  const cleaned = (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!cleaned) return "pro";
  return cleaned.slice(0, 48);
}

export function isReservedShareSlug(slug: string): boolean {
  return RESERVED_SHARE_SLUGS.has(slug.toLowerCase());
}

export function publicShareUrl(slug: string): string {
  const origin = (SITE_URL || "https://www.altshift.ca").replace(/\/$/, "");
  return `${origin}/${slug}`;
}

/** Two deterministic alternate slugs (e.g. aymenservices43, aymenservices52). */
export function suggestAlternateShareSlugs(base: string, salt = ""): [string, string] {
  const root = slugifyShareName(base) || "pro";
  const h = Math.abs(
    Array.from(`${root}:${salt}`).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7),
  );
  const a = 10 + (h % 89);
  const b = 10 + ((h >>> 7) % 89);
  const second = a === b ? (a === 98 ? 97 : a + 1) : b;
  return [`${root}${a}`, `${root}${second}`];
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}
