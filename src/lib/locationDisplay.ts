/**
 * Strip Canadian postal code (A1A 1A1) and parenthetical postal codes (H2X, H3A, ...) from location.
 * Returns city-focused display (e.g. "Montreal, QC") so we never show "(H2X, H3A, H3B, H4A)".
 */
export function formatLocationCity(location: string | null | undefined): string {
  if (!location || !location.trim()) return "";
  let s = location.trim();
  // Remove parenthetical postal codes e.g. "(H2X, H3A, H3B, H4A)" or "(H2X 1Y2)"
  s = s.replace(/\s*\([^)]*[A-Z]\d[A-Z][^)]*\)\s*/gi, "").trim();
  // Remove Canadian postal code at end (e.g. "H2X 1Y2" or "H2X1Y2")
  s = s.replace(/\s*[A-Z]\d[A-Z]\s*\d[A-Z]\d\s*$/i, "").trim();
  if (!s) return "";
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (last.length <= 3 && /^[A-Z]{2}$/i.test(last)) return `${secondLast}, ${last.toUpperCase()}`;
  }
  return s;
}
