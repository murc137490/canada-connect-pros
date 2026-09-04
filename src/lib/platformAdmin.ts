import { PLATFORM_ADMIN_ALLOWLIST, SUPER_ADMIN_EMAIL } from "@/lib/platformAdminAllowlist";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

export function getPlatformAdminEmails(): string[] {
  return [...PLATFORM_ADMIN_ALLOWLIST];
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const em = normalizeEmail(email);
  return em.length > 0 && (PLATFORM_ADMIN_ALLOWLIST as readonly string[]).includes(em);
}

/**
 * Platform admin tools: seed allowlist, super admin, or DB flag granted by super admin.
 */
export function canUsePlatformAdminTools(
  userEmail: string | null | undefined,
  profileIsPlatformAdmin?: boolean | null,
): boolean {
  if (isSuperAdminEmail(userEmail) || isPlatformAdminEmail(userEmail)) return true;
  return profileIsPlatformAdmin === true;
}

export function isMonitorPlatformAdmin(email: string | null | undefined): boolean {
  return isPlatformAdminEmail(email) || isSuperAdminEmail(email);
}
