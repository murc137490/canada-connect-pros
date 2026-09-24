/**
 * Shared tier palette for favicons + PWA icons.
 * S uses a diagonal gradient. In-app cutouts punch A transparent so it
 * inherits the page background (white in light mode, black in dark mode).
 */

/** @typedef {[number, number, number]} RGB */
/**
 * @typedef {{
 *   id: string,
 *   bg: RGB,
 *   sFrom: RGB,
 *   sTo: RGB,
 *   sFromLight: RGB,
 *   sToLight: RGB,
 *   theme: string
 * }} TierTheme
 */

/** @type {TierTheme[]} */
export const TIER_THEMES = [
  {
    id: "client",
    bg: [10, 10, 10],
    // Dark surfaces: light S
    sFrom: [170, 170, 170],
    sTo: [240, 240, 240],
    // Light surfaces: darker S (A stays transparent → reads white)
    sFromLight: [28, 28, 28],
    sToLight: [72, 72, 72],
    theme: "#0a0a0a",
  },
  {
    id: "starter",
    bg: [15, 23, 42],
    sFrom: [30, 64, 175],
    sTo: [125, 211, 252],
    sFromLight: [30, 58, 138],
    sToLight: [37, 99, 235],
    theme: "#1e3a8a",
  },
  {
    id: "growth",
    bg: [2, 44, 34],
    sFrom: [4, 120, 87],
    sTo: [110, 231, 183],
    sFromLight: [6, 78, 59],
    sToLight: [4, 120, 87],
    theme: "#047857",
  },
  {
    id: "pro",
    bg: [30, 27, 75],
    sFrom: [91, 33, 182],
    sTo: [249, 168, 212],
    sFromLight: [76, 29, 149],
    sToLight: [147, 51, 234],
    theme: "#6d28d9",
  },
];

/** Cache-bust query baked into generated webmanifest icon URLs. */
export const ICON_ASSET_VER = "10";

export function nearLight(r, g, b) {
  return (r + g + b) / 3 > 140;
}

export function nearDark(r, g, b) {
  return r + g + b < 120;
}

/** Diagonal gradient t in [0,1] across the bitmap. */
export function gradientT(x, y, w, h) {
  return Math.min(1, Math.max(0, (x / Math.max(1, w - 1) + y / Math.max(1, h - 1)) / 2));
}

/** @param {RGB} from @param {RGB} to @param {number} t */
export function lerpRgb(from, to, t) {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

/** @param {TierTheme} theme @param {boolean} [forLightSurface] */
export function sColorAt(theme, x, y, w, h, forLightSurface = false) {
  const from = forLightSurface ? theme.sFromLight : theme.sFrom;
  const to = forLightSurface ? theme.sToLight : theme.sTo;
  return lerpRgb(from, to, gradientT(x, y, w, h));
}
