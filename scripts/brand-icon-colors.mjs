/**
 * Shared tier palette for favicons + PWA icons.
 * S uses a diagonal gradient; A stays pure black.
 */

/** @typedef {[number, number, number]} RGB */
/** @typedef {{ id: string, bg: RGB, a: RGB, sFrom: RGB, sTo: RGB, theme: string }} TierTheme */

/** @type {TierTheme[]} */
export const TIER_THEMES = [
  {
    id: "client",
    bg: [10, 10, 10],
    a: [0, 0, 0],
    sFrom: [150, 150, 150],
    sTo: [235, 235, 235],
    theme: "#0a0a0a",
  },
  {
    id: "starter",
    bg: [15, 23, 42],
    a: [0, 0, 0],
    sFrom: [30, 64, 175],
    sTo: [125, 211, 252],
    theme: "#1e3a8a",
  },
  {
    id: "growth",
    bg: [2, 44, 34],
    a: [0, 0, 0],
    sFrom: [4, 120, 87],
    sTo: [110, 231, 183],
    theme: "#047857",
  },
  {
    id: "pro",
    bg: [30, 27, 75],
    a: [0, 0, 0],
    sFrom: [91, 33, 182],
    sTo: [249, 168, 212],
    theme: "#6d28d9",
  },
];

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

export function sColorAt(theme, x, y, w, h) {
  return lerpRgb(theme.sFrom, theme.sTo, gradientT(x, y, w, h));
}
