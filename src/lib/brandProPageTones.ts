/** Public pro page surfaces tinted from brand primary (and optional secondary), light + dark. */

export type ProPageDarkTones = {
  shellGradient: string;
  cardSurface: string;
  headerStrip: string;
  sidebarSurface: string;
  guaranteePanel: string;
  guaranteeBorder: string;
};

export type ProPageLightTones = ProPageDarkTones;

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexRgb(input: string): [number, number, number] | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      parseInt(raw[0] + raw[0], 16),
      parseInt(raw[1] + raw[1], 16),
      parseInt(raw[2] + raw[2], 16),
    ];
  }
  return null;
}

function toHex(r: number, g: number, b: number) {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const u = Math.max(0, Math.min(1, t));
  return [
    a[0] * (1 - u) + b[0] * u,
    a[1] * (1 - u) + b[1] * u,
    a[2] * (1 - u) + b[2] * u,
  ];
}

const NEAR_BLACK: [number, number, number] = [3, 7, 20];
const FALLBACK_PRIMARY: [number, number, number] = [30, 58, 95];

/**
 * Light shell: cool gray base (not pure white) so brand mixes read like dark mode’s depth,
 * with extra mid-stops for a smoother vertical transition.
 */
const SHELL_LIGHT_BASE: [number, number, number] = [236, 241, 249];

/**
 * Main profile card in light: near-pure white so it clearly sits above the tinted shell
 * (same “pop” as dark card vs dark shell).
 */
const CARD_LIGHT_ANCHOR: [number, number, number] = [255, 255, 255];

/**
 * Cohesive light-mode backgrounds — shell visibly branded; card/side panels brighter for contrast.
 */
export function buildProPageLightTones(
  primaryHex: string,
  secondaryHex?: string | null
): ProPageLightTones {
  const p = parseHexRgb(primaryHex) ?? FALLBACK_PRIMARY;
  const s = secondaryHex && parseHexRgb(secondaryHex) ? parseHexRgb(secondaryHex)! : p;

  // Shell: stronger brand wash + 5-stop gradient (smooth ramp like a richer dark shell, inverted for light).
  const sh0 = mixRgb(SHELL_LIGHT_BASE, p, 0.2);
  const sh1 = mixRgb(SHELL_LIGHT_BASE, p, 0.28);
  const sh2 = mixRgb(SHELL_LIGHT_BASE, p, 0.34);
  const sh3 = mixRgb(SHELL_LIGHT_BASE, s, 0.38);
  const sh4 = mixRgb(SHELL_LIGHT_BASE, s, 0.42);
  const shellGradient = `linear-gradient(180deg, ${toHex(...sh0)} 0%, ${toHex(...sh1)} 26%, ${toHex(...sh2)} 52%, ${toHex(...sh3)} 78%, ${toHex(...sh4)} 100%)`;

  // Card: minimal tint so it reads clearly brighter than the shell.
  const cardRgb = mixRgb(CARD_LIGHT_ANCHOR, p, 0.018);
  const headerRgb = mixRgb([238, 242, 250], p, 0.22);
  const sidebarRgb = mixRgb([248, 250, 252], p, 0.07);
  const guaranteeRgb = mixRgb([240, 247, 255], p, 0.16);
  const borderRgb = mixRgb([214, 226, 242], p, 0.22);

  return {
    shellGradient,
    cardSurface: toHex(...cardRgb),
    headerStrip: toHex(...headerRgb),
    sidebarSurface: toHex(...sidebarRgb),
    guaranteePanel: toHex(...guaranteeRgb),
    guaranteeBorder: toHex(...borderRgb),
  };
}

/**
 * Cohesive dark-mode backgrounds (near-black mixed with brand).
 */
export function buildProPageDarkTones(
  primaryHex: string,
  secondaryHex?: string | null
): ProPageDarkTones {
  const p = parseHexRgb(primaryHex) ?? FALLBACK_PRIMARY;
  const s = secondaryHex && parseHexRgb(secondaryHex) ? parseHexRgb(secondaryHex)! : p;

  const shellTop = mixRgb(NEAR_BLACK, p, 0.16);
  const shellMid = mixRgb(NEAR_BLACK, p, 0.22);
  const shellBot = mixRgb(NEAR_BLACK, s, 0.24);

  const cardRgb = mixRgb([2, 6, 18], p, 0.13);
  const headerRgb = mixRgb([12, 18, 34], p, 0.2);
  const sidebarRgb = mixRgb([5, 9, 22], p, 0.15);
  const guaranteeRgb = mixRgb([8, 12, 26], p, 0.11);
  const borderRgb = mixRgb([18, 24, 40], p, 0.28);

  const shellGradient = `linear-gradient(180deg, ${toHex(...shellTop)} 0%, ${toHex(...shellMid)} 48%, ${toHex(...shellBot)} 100%)`;

  return {
    shellGradient,
    cardSurface: toHex(...cardRgb),
    headerStrip: toHex(...headerRgb),
    sidebarSurface: toHex(...sidebarRgb),
    guaranteePanel: toHex(...guaranteeRgb),
    guaranteeBorder: toHex(...borderRgb),
  };
}
