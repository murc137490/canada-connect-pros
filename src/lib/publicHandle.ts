import { CANONICAL_ORIGIN } from "@/components/CanonicalUrl";

/**
 * Public vanity links: https://www.altshift.ca/<username>.
 * The username (profiles.username) is the single public handle; for pros the DB mirrors it
 * into pro_profiles.share_slug, so either field can be used to build a link.
 * Keep RESERVED_HANDLES in sync with public.username_is_reserved() (migration 20261009000400).
 */
export const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

export const RESERVED_HANDLES = new Set([
  "admin", "administrator", "altshift", "alt-shift", "alt.shift", "support", "help",
  "root", "system", "staff", "moderator", "security", "billing", "info", "contact",
  "noreply", "no-reply", "null", "undefined", "anonymous", "service", "services",
  "pros", "pro", "join-pros", "pro-plans", "create-pro-account", "pro-onboarding",
  "dashboard", "make-request", "front-desk", "about", "a-propos", "get-app",
  "terms", "privacy", "privacy-policy", "politique-de-confidentialite", "cookies",
  "cookie-policy", "phone-preview", "reset-password", "book-again", "unsubscribe",
  "confirm-deletion", "pay", "auth", "login", "logout", "signin", "signup", "sign-in",
  "sign-up", "register", "search", "api", "assets", "static", "public", "well-known",
  "favicon", "robots", "sitemap", "manifest", "index", "home", "settings", "account",
  "accounts", "profile", "profiles", "user", "users", "me", "new", "edit", "blog",
  "careers", "jobs", "job", "whats-new", "news", "invite", "invites", "ref", "referral",
  "app", "apps", "www", "mail", "email", "legal", "faq", "guide", "pricing", "plans",
  "checkout", "booking", "bookings", "messages", "notifications", "reviews", "invoices",
  "favorites", "categories", "category", "sw", "offline", "status", "not-found", "404",
]);

const FILE_LIKE = /\.(js|mjs|css|map|png|jpe?g|gif|svg|webp|avif|ico|txt|xml|json|webmanifest|html?|pdf|zip)$/i;

export function normalizeHandle(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/^@/, "");
}

export function isReservedHandle(raw: string): boolean {
  const h = normalizeHandle(raw);
  return RESERVED_HANDLES.has(h) || FILE_LIKE.test(h);
}

export function isValidHandle(raw: string): boolean {
  const h = normalizeHandle(raw);
  return USERNAME_RE.test(h) && !isReservedHandle(h);
}

/** In-app path for a pro: /<username> when known, otherwise the id route (which redirects). */
export function proPublicPath(pro: { id: string; share_slug?: string | null; username?: string | null }): string {
  const h = normalizeHandle(pro.username || pro.share_slug);
  return h && USERNAME_RE.test(h) ? `/${h}` : `/pros/${pro.id}`;
}

export function publicHandleUrl(handle: string): string {
  return `${CANONICAL_ORIGIN}/${normalizeHandle(handle)}`;
}

export type ResolvedHandle =
  | { status: "ok"; kind: "pro"; username: string; pro_profile_id: string }
  | { status: "ok"; kind: "member"; username: string; first_name: string | null; member_since: number | null }
  | { status: "redirect"; username: string | null; pro_profile_id?: string }
  | { status: "not_found" };
