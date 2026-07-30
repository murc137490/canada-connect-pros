/** Only these accounts may be platform admins (monitor / control panel). No other email can gain admin. */
export const PLATFORM_ADMIN_ALLOWLIST = [
  "admin1@premiereservices.ca",
  "admin2@premiereservices.ca",
  "admin3@premiereservices.ca",
  "admin4@premiereservices.ca",
  "admin5@premiereservices.ca",
] as const;

export type PlatformAdminEmail = (typeof PLATFORM_ADMIN_ALLOWLIST)[number];
