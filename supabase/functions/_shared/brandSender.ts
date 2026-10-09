/**
 * Single source of truth for the email sender. Always "AltShift <...@altshift.ca>".
 * FROM_NAME / FROM_EMAIL secrets are ignored unless the address is on altshift.ca
 * (old-brand values in project secrets must never leak into outgoing mail).
 */
export const BRAND_FROM_NAME = "AltShift";
export const BRAND_DEFAULT_FROM_EMAIL = "support@altshift.ca";
export const BRAND_REPLY_TO = "support@altshift.ca";

export function brandAddress(raw?: string | null): string {
  const v = (raw ?? "").trim().toLowerCase();
  return /^[a-z0-9._%+-]+@altshift\.ca$/.test(v) ? v : BRAND_DEFAULT_FROM_EMAIL;
}

export function brandFrom(raw?: string | null): string {
  return `${BRAND_FROM_NAME} <${brandAddress(raw)}>`;
}
