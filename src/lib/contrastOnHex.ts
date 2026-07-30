/** True when a #RRGGBB background should use dark text for readability. */
export function isLightHexColor(hex: string | null | undefined): boolean {
  if (!hex?.trim()) return true;
  const h = hex.trim().replace(/^#/, "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return true;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}
