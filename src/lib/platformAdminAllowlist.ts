/** Seed monitor emails + supreme super-admin. Dynamic admins use profiles.is_platform_admin. */

export const SUPER_ADMIN_EMAIL = "murc137490@gmail.com";

/** Legacy seeded monitor accounts (still valid). */
export const PLATFORM_ADMIN_ALLOWLIST = [
  SUPER_ADMIN_EMAIL,
  "admin1@premiereservices.ca",
  "admin2@premiereservices.ca",
  "admin3@premiereservices.ca",
  "admin4@premiereservices.ca",
  "admin5@premiereservices.ca",
] as const;

export type PlatformAdminEmail = (typeof PLATFORM_ADMIN_ALLOWLIST)[number];
