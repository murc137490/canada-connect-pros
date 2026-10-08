/**
 * Client-side admin detection uses profiles.is_platform_admin (and related RPCs).
 * Seed / secret allowlists live only in edge functions (`PLATFORM_ADMIN_EMAILS`) —
 * do not hardcode admin emails in the browser bundle.
 */

/** Optional override via Vite env (not required when DB flag is set). */
export const SUPER_ADMIN_EMAIL = (
  (import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined) ?? ""
)
  .toLowerCase()
  .trim();

/** Intentionally empty in the client bundle. */
export const PLATFORM_ADMIN_ALLOWLIST: readonly string[] = SUPER_ADMIN_EMAIL
  ? ([SUPER_ADMIN_EMAIL] as const)
  : ([] as const);

export type PlatformAdminEmail = string;
