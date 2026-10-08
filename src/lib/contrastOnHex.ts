function parseHex6(hex: string | null | undefined): [number, number, number] | null {
  const h = (hex ?? "").trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** True when a #RRGGBB background should use dark text for readability. */
export function isLightHexColor(hex: string | null | undefined): boolean {
  if (!hex?.trim()) return true;
  const rgb = parseHex6(hex);
  if (!rgb) return true;
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex6(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function wcagContrast(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or black, whichever reads better on `bg` (WCAG). */
export function bestInkOn(bg: string | null | undefined): "#FFFFFF" | "#000000" {
  const white = wcagContrast(bg ?? "", "#FFFFFF");
  const black = wcagContrast(bg ?? "", "#000000");
  if (white == null || black == null) return "#FFFFFF";
  return white >= 4.5 || white >= black ? "#FFFFFF" : "#000000";
}

/** Darken (or lighten on dark bg) `fg` until it reaches 4.5:1 on `bg` - for coloured text. */
export function readableTextColor(fg: string | null | undefined, bg = "#FFFFFF"): string | null {
  const rgb = parseHex6(fg);
  if (!rgb) return fg ?? null;
  const bgLum = relativeLuminance(bg) ?? 1;
  const target: [number, number, number] = bgLum > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = rgb.map((v, i) => Math.round(v * (1 - t) + target[i] * t));
    const hex = `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if ((wcagContrast(hex, bg) ?? 0) >= 4.5) return hex;
  }
  return bgLum > 0.5 ? "#000000" : "#FFFFFF";
}

/** CIELAB distance between two hex colours (for "closest colour" fallbacks). */
export function hexDistanceLab(a: string, b: string): number {
  const lab = (hex: string) => {
    const rgb = parseHex6(hex) ?? [0, 0, 0];
    const [r, g, bl] = rgb.map((v) => {
      const c = v / 255;
      return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
    });
    const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    const y = r * 0.2126 + g * 0.7152 + bl * 0.0722;
    const z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const A = lab(a);
  const B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
