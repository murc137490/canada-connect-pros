/**
 * Featured-profile colour palette (Growth & Pro public pages).
 * `primary` is the exact brand swatch; secondary/accent/background are derived tints.
 * `ink` is the text colour that meets WCAG AA (≥ 4.5:1) on `primary`:
 * white on the deep colours, black on Dusty Rose / Burnt Terracotta / Antique Gold
 * (white text measures 3.75 / 4.22 / 2.90 on those, which fails AA).
 */
import { hexDistanceLab } from "@/lib/contrastOnHex";

export interface ProPageColorScheme {
  id: string;
  name: { en: string; fr: string };
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  /** Readable text colour on `primary`. */
  ink: string;
}

export const PRO_PAGE_COLOR_SCHEMES: ProPageColorScheme[] = [
  { id: "dustyRose", name: { en: "Dusty Rose", fr: "Rose poudré" }, primary: "#B86F7A", secondary: "#C3868F", accent: "#F5EBEC", background: "#FBF6F7", ink: "#000000" },
  { id: "burntTerracotta", name: { en: "Burnt Terracotta", fr: "Terre cuite brûlée" }, primary: "#B7654A", secondary: "#C37E67", accent: "#F5E9E6", background: "#FBF6F4", ink: "#000000" },
  { id: "antiqueGold", name: { en: "Antique Gold", fr: "Or antique" }, primary: "#B39445", secondary: "#BFA563", accent: "#F4F0E5", background: "#FAF9F4", ink: "#000000" },
  { id: "deepForest", name: { en: "Deep Forest", fr: "Forêt profonde" }, primary: "#31594D", secondary: "#28493F", accent: "#E2E8E6", background: "#F3F5F4", ink: "#FFFFFF" },
  { id: "cobaltSlate", name: { en: "Cobalt Slate", fr: "Ardoise cobalt" }, primary: "#49658A", secondary: "#3C5371", accent: "#E6E9EF", background: "#F4F6F8", ink: "#FFFFFF" },
  { id: "aubergine", name: { en: "Aubergine", fr: "Aubergine" }, primary: "#5A3F61", secondary: "#4A3450", accent: "#E8E4E9", background: "#F5F3F6", ink: "#FFFFFF" },
  { id: "oxblood", name: { en: "Oxblood", fr: "Sang de bœuf" }, primary: "#682F3B", secondary: "#552730", accent: "#EAE2E4", background: "#F6F3F3", ink: "#FFFFFF" },
  { id: "charcoal", name: { en: "Charcoal", fr: "Charbon" }, primary: "#292929", secondary: "#222222", accent: "#E1E1E1", background: "#F2F2F2", ink: "#FFFFFF" },
];

export const DEFAULT_PRO_PAGE_COLOR_SCHEME = PRO_PAGE_COLOR_SCHEMES[4]; // Cobalt Slate

/** Old (pre-Oct 2026) scheme ids → new ids (nearest colour, CIELAB distance). */
export const LEGACY_SCHEME_ID_MAP: Record<string, string> = {
  navyTeal: "cobaltSlate",
  forestGreen: "deepForest",
  burgundy: "oxblood",
  slateBlue: "charcoal",
  warmAmber: "burntTerracotta",
  deepPurple: "aubergine",
  ocean: "cobaltSlate",
};

export function schemeLabel(scheme: ProPageColorScheme, locale: string): string {
  return locale === "fr" ? scheme.name.fr : scheme.name.en;
}

export function getSchemeById(id: string | null | undefined): ProPageColorScheme | undefined {
  if (!id) return undefined;
  const mapped = LEGACY_SCHEME_ID_MAP[id] ?? id;
  return PRO_PAGE_COLOR_SCHEMES.find((s) => s.id === mapped);
}

/** Exact match on the primary swatch (secondary is derived, so it is not required to match). */
export function getSchemeIdFromColors(primary: string | null, _secondary?: string | null): string | null {
  if (!primary) return null;
  const p = primary.trim().toLowerCase();
  const found = PRO_PAGE_COLOR_SCHEMES.find((scheme) => scheme.primary.toLowerCase() === p);
  return found?.id ?? null;
}

/**
 * Render-time fallback: any saved primary colour that is not in the palette (old schemes,
 * hand-edited values) resolves to the closest palette colour, so no profile breaks.
 */
export function resolveProPageScheme(primary: string | null | undefined): ProPageColorScheme {
  const raw = (primary ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(raw)) return DEFAULT_PRO_PAGE_COLOR_SCHEME;
  const exact = PRO_PAGE_COLOR_SCHEMES.find((s) => s.primary.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  let best = DEFAULT_PRO_PAGE_COLOR_SCHEME;
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of PRO_PAGE_COLOR_SCHEMES) {
    const d = hexDistanceLab(raw, s.primary);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
