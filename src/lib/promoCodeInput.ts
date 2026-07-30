/** Extract trial token or promo code from a pasted URL or raw string. */
export function normalizePromotionalInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const fromQueryParam = trimmed.match(/[?&]token=([^&\s#]+)/i);
  if (fromQueryParam?.[1]) {
    try {
      return decodeURIComponent(fromQueryParam[1]).trim();
    } catch {
      return fromQueryParam[1].trim();
    }
  }

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    try {
      const url = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const token = url.searchParams.get("token")?.trim();
      if (token) return token;
    } catch {
      // not a parseable URL — use trimmed value
    }
  }

  return trimmed;
}
