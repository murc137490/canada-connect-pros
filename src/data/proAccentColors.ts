/**
 * Accent colour options for pro profiles (stored as pro_accent_color).
 * Same 8 swatches as the featured-profile palette. Legacy ids/hex values resolve to the closest swatch.
 */
import { PRO_PAGE_COLOR_SCHEMES, resolveProPageScheme } from "@/data/proPageColorSchemes";

export const PRO_ACCENT_COLORS = PRO_PAGE_COLOR_SCHEMES.map((s) => ({ id: s.id, name: s.name.en, hex: s.primary }));

export type ProAccentColorId = string;
export type ProAccentHex = string;

const LEGACY_ACCENT_HEX: Record<string, string> = {
  blue: "#2563EB",
  "dark-green": "#15803D",
  orange: "#EA580C",
  red: "#DC2626",
  purple: "#7C3AED",
  "dark-slate": "#334155",
  charcoal: "#292929",
};

export function getAccentHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  const found = PRO_ACCENT_COLORS.find((c) => c.id === v || c.hex.toLowerCase() === v.toLowerCase());
  if (found) return found.hex;
  const legacyHex = LEGACY_ACCENT_HEX[v] ?? (v.startsWith("#") ? v : null);
  return legacyHex ? resolveProPageScheme(legacyHex).primary : null;
}
