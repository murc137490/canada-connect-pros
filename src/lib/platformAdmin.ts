import { PLATFORM_ADMIN_ALLOWLIST } from "@/lib/platformAdminAllowlist";

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

/** Fixed Premiere monitor-admin accounts (see platformAdminAllowlist.ts). */
export function getPlatformAdminEmails(): string[] {
  return [...PLATFORM_ADMIN_ALLOWLIST];
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const em = normalizeEmail(email);
  return em.length > 0 && (PLATFORM_ADMIN_ALLOWLIST as readonly string[]).includes(em);
}

/** Monitor-only admin: email must be on the allowlist (profile flag is synced from ensure-platform-admin). */
export function canUsePlatformAdminTools(
  userEmail: string | null | undefined,
  _profileIsPlatformAdmin?: boolean | null,
): boolean {
  return isPlatformAdminEmail(userEmail);
}

export function isMonitorPlatformAdmin(email: string | null | undefined): boolean {
  return isPlatformAdminEmail(email);
}
