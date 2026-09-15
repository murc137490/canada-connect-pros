/** Seed monitor emails + supreme super-admin. Dynamic admins use profiles.is_platform_admin. */

export const SUPER_ADMIN_EMAIL = "murc137490@gmail.com";

/** Legacy seeded monitor accounts (still valid). */
export const PLATFORM_ADMIN_ALLOWLIST = [
  SUPER_ADMIN_EMAIL,
  "admin1@altshift.ca",
  "admin2@altshift.ca",
  "admin3@altshift.ca",
  "admin4@altshift.ca",
  "admin5@altshift.ca",
] as const;

export type PlatformAdminEmail = (typeof PLATFORM_ADMIN_ALLOWLIST)[number];
