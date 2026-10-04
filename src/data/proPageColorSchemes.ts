/**
 * Palettes for “Personalize your page”.
 * The named color is the page primary. Secondary, accent, and background stay in the same family.
 */
export interface ProPageColorScheme {
  id: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export const DEFAULT_PRO_PAGE_SCHEME_ID = "deepForest";

export const PRO_PAGE_COLOR_SCHEMES: ProPageColorScheme[] = [
  {
    id: "dustyRose",
    primary: "#B86F7A",
    secondary: "#8C4A55",
    accent: "#F3DDE1",
    background: "#FBF6F7",
  },
  {
    id: "burntTerracotta",
    primary: "#B7654A",
    secondary: "#8A4530",
    accent: "#F6E0D8",
    background: "#FBF6F3",
  },
  {
    id: "antiqueGold",
    primary: "#B39445",
    secondary: "#7A6428",
    accent: "#F3EBD4",
    background: "#FBF8F1",
  },
  {
    id: "deepForest",
    primary: "#31594D",
    secondary: "#1E3A32",
    accent: "#D5E6E0",
    background: "#F4F8F6",
  },
  {
    id: "cobaltSlate",
    primary: "#49658A",
    secondary: "#2E4460",
    accent: "#D9E3EF",
    background: "#F4F7FA",
  },
  {
    id: "aubergine",
    primary: "#5A3F61",
    secondary: "#3D2A43",
    accent: "#E6DCE8",
    background: "#F8F5F8",
  },
  {
    id: "oxblood",
    primary: "#682F3B",
    secondary: "#451E27",
    accent: "#F0DADF",
    background: "#FBF6F7",
  },
  {
    id: "charcoal",
    primary: "#292929",
    secondary: "#4A4A4A",
    accent: "#E6E6E6",
    background: "#F7F7F7",
  },
];

export function getSchemeById(id: string): ProPageColorScheme | undefined {
  return PRO_PAGE_COLOR_SCHEMES.find((s) => s.id === id);
}

export function getSchemeIdFromColors(primary: string | null, secondary: string | null): string | null {
  if (!primary && !secondary) return null;
  const p = (primary || "").toLowerCase();
  const s = (secondary || "").toLowerCase();
  const found = PRO_PAGE_COLOR_SCHEMES.find(
    (scheme) => scheme.primary.toLowerCase() === p && scheme.secondary.toLowerCase() === s,
  );
  return found?.id ?? null;
}
