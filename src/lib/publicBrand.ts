/** Rewrite leftover Première Services copy so public and signed-in views both say AltShift. */
export function withAltShiftBrand(text: string | null | undefined): string | null {
  if (text == null) return null;
  return text.replace(/premi[eè]re services/gi, "AltShift");
}
