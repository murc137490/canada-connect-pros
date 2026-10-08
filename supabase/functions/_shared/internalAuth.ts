/**
 * Server-to-server auth for cron / internal edge-function calls.
 * - Service-role bearer (function -> function), or
 * - x-booking-reminder-secret matching env BOOKING_REMINDER_SECRET or the Vault secret
 *   `booking_reminder_cron_secret` (checked via service_role-only RPC internal_check_cron_secret).
 */
// deno-lint-ignore-file no-explicit-any
function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bearerToken(req: Request): string {
  const h = req.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

export function isServiceRoleRequest(req: Request): boolean {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return timingSafeEqual(bearerToken(req), key);
}

export async function isValidCronSecret(admin: any, secret: string | null): Promise<boolean> {
  const s = (secret ?? "").trim();
  if (!s) return false;
  const envSecret = (Deno.env.get("BOOKING_REMINDER_SECRET") ?? "").trim();
  if (envSecret && timingSafeEqual(s, envSecret)) return true;
  const { data, error } = await admin.rpc("internal_check_cron_secret", { p_secret: s });
  return !error && data === true;
}

export async function isInternalRequest(req: Request, admin: any): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true;
  return await isValidCronSecret(admin, req.headers.get("x-booking-reminder-secret"));
}
