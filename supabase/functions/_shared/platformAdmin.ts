/** Platform admins: seed allowlist + supreme email. Dynamic staff use profiles.is_platform_admin. */

export const SUPER_ADMIN_EMAIL = "murc137490@gmail.com";

const PLATFORM_ADMIN_ALLOWLIST = [
  SUPER_ADMIN_EMAIL,
  "admin1@premiereservices.ca",
  "admin2@premiereservices.ca",
  "admin3@premiereservices.ca",
  "admin4@premiereservices.ca",
  "admin5@premiereservices.ca",
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

export function parsePlatformAdminEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((e) => normalizeEmail(e)).filter(Boolean))];
}

export function getPlatformAdminEmails(): string[] {
  const fromSecret = parsePlatformAdminEmailList(Deno.env.get("PLATFORM_ADMIN_EMAILS"));
  const allow = new Set(PLATFORM_ADMIN_ALLOWLIST.map((e) => normalizeEmail(e)));
  allow.add(SUPER_ADMIN_EMAIL);
  if (fromSecret.length === 0) return [...allow];
  const filtered = fromSecret.filter((e) => allow.has(e));
  if (!filtered.includes(SUPER_ADMIN_EMAIL)) filtered.unshift(SUPER_ADMIN_EMAIL);
  return filtered;
}

const ALLOW_SET = new Set(PLATFORM_ADMIN_ALLOWLIST.map((e) => normalizeEmail(e)));

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === SUPER_ADMIN_EMAIL;
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const em = normalizeEmail(email);
  return em.length > 0 && (ALLOW_SET.has(em) || em === SUPER_ADMIN_EMAIL);
}

export async function callerIsPlatformModerator(
  adminClient: { from: (table: string) => { select: (cols: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { is_platform_admin?: boolean } | null }> } } } },
  userId: string,
  email: string | undefined,
): Promise<boolean> {
  if (isPlatformAdminEmail(email) || isSuperAdminEmail(email)) return true;
  try {
    const { data } = await adminClient.from("profiles").select("is_platform_admin").eq("user_id", userId).maybeSingle();
    return data?.is_platform_admin === true;
  } catch {
    return false;
  }
}
