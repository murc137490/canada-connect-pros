/**
 * Guards for user-supplied links rendered as <a href> (security review 2026-10-08, MED 7).
 * Only http(s) URLs (and, where allowed, same-site absolute paths) pass; javascript:, data:,
 * vbscript:, protocol-relative //host and anything unparsable return null.
 */
export function safeHttpUrl(
  raw: string | null | undefined,
  opts: { allowRelative?: boolean; assumeHttps?: boolean } = {},
): string | null {
  if (typeof raw !== "string") return null;
  // Strip control chars / whitespace that browsers ignore inside schemes (e.g. "java\tscript:").
  // eslint-disable-next-line no-control-regex
  const value = raw.replace(/[\u0000-\u0020\u007f]+/g, (m, offset: number) => (offset === 0 ? "" : m)).trim();
  if (!value) return null;
  if (opts.allowRelative && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  let candidate = value;
  if (opts.assumeHttps && !/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !candidate.startsWith("//")) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}
