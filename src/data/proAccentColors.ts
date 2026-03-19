/** Accent color options for pro profiles. Stored as pro_accent_color in DB. */
export const PRO_ACCENT_COLORS = [
  { id: "blue", name: "Blue", hex: "#2563EB" },
  { id: "dark-green", name: "Dark Green", hex: "#15803D" },
  { id: "orange", name: "Orange", hex: "#EA580C" },
  { id: "red", name: "Red", hex: "#DC2626" },
  { id: "purple", name: "Purple", hex: "#7C3AED" },
  { id: "dark-slate", name: "Dark Slate", hex: "#334155" },
  { id: "charcoal", name: "Charcoal", hex: "#111827" },
] as const;

export type ProAccentColorId = (typeof PRO_ACCENT_COLORS)[number]["id"];
export type ProAccentHex = (typeof PRO_ACCENT_COLORS)[number]["hex"];

export function getAccentHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const found = PRO_ACCENT_COLORS.find((c) => c.id === value || c.hex === value);
  return found ? found.hex : value.startsWith("#") ? value : null;
}
