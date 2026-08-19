/**
 * Demo / example content helpers.
 * Never present fabricated ratings, testimonials, or counts as real customer data.
 */

export const DEMO_LABEL = {
  en: "Example",
  fr: "Exemple",
} as const;

export const DEMO_PRESENTATION_LABEL = {
  en: "Demo presentation",
  fr: "Exemple de présentation",
} as const;

export function isDemoFlagged(meta?: { isDemo?: boolean } | null): boolean {
  return !!meta?.isDemo;
}
