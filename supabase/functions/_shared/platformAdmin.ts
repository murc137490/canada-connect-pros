/** Platform admins: fixed allowlist only (monitor accounts). */

const PLATFORM_ADMIN_ALLOWLIST = [
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

/** Returns allowlisted emails only (ignores extra addresses in PLATFORM_ADMIN_EMAILS secret). */
export function getPlatformAdminEmails(): string[] {
  const fromSecret = parsePlatformAdminEmailList(Deno.env.get("PLATFORM_ADMIN_EMAILS"));
  const allow = new Set(PLATFORM_ADMIN_ALLOWLIST.map((e) => normalizeEmail(e)));
  if (fromSecret.length === 0) return [...PLATFORM_ADMIN_ALLOWLIST];
  return fromSecret.filter((e) => allow.has(e));
}

const ALLOW_SET = new Set(PLATFORM_ADMIN_ALLOWLIST.map((e) => normalizeEmail(e)));

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const em = normalizeEmail(email);
  return em.length > 0 && ALLOW_SET.has(em);
}

export async function callerIsPlatformModerator(
  adminClient: { from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } } },
  _userId: string,
  email: string | undefined,
): Promise<boolean> {
  return isPlatformAdminEmail(email);
}
