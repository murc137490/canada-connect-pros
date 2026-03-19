/**
 * Predefined color schemes for pro public pages.
 * Keys are used for i18n: createPro.scheme{Id} e.g. schemeNavyTeal
 */
export interface ProPageColorScheme {
  id: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export const PRO_PAGE_COLOR_SCHEMES: ProPageColorScheme[] = [
  {
    id: "navyTeal",
    primary: "#1e3a5f",
    secondary: "#0d9488",
    accent: "#e0f2f1",
    background: "#f8fafc",
  },
  {
    id: "forestGreen",
    primary: "#14532d",
    secondary: "#22c55e",
    accent: "#dcfce7",
    background: "#f0fdf4",
  },
  {
    id: "burgundy",
    primary: "#7f1d1d",
    secondary: "#b91c1c",
    accent: "#fef2f2",
    background: "#fef2f2",
  },
  {
    id: "slateBlue",
    primary: "#1e293b",
    secondary: "#3b82f6",
    accent: "#e0e7ff",
    background: "#f1f5f9",
  },
  {
    id: "warmAmber",
    primary: "#92400e",
    secondary: "#d97706",
    accent: "#fffbeb",
    background: "#fffbeb",
  },
  {
    id: "deepPurple",
    primary: "#4c1d95",
    secondary: "#7c3aed",
    accent: "#ede9fe",
    background: "#f5f3ff",
  },
  {
    id: "ocean",
    primary: "#0c4a6e",
    secondary: "#0ea5e9",
    accent: "#e0f2fe",
    background: "#f0f9ff",
  },
  {
    id: "charcoal",
    primary: "#171717",
    secondary: "#525252",
    accent: "#fafafa",
    background: "#fafafa",
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
    (scheme) => scheme.primary.toLowerCase() === p && scheme.secondary.toLowerCase() === s
  );
  return found?.id ?? null;
}
