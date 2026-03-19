/** 15 most spoken languages in Canada – codes and English/French labels for display */
export const CANADIAN_LANGUAGES = [
  { code: "en", nameEn: "English", nameFr: "Anglais" },
  { code: "fr", nameEn: "French", nameFr: "Français" },
  { code: "zh", nameEn: "Mandarin", nameFr: "Mandarin" },
  { code: "yue", nameEn: "Cantonese", nameFr: "Cantonais" },
  { code: "pa", nameEn: "Punjabi", nameFr: "Pendjabi" },
  { code: "es", nameEn: "Spanish", nameFr: "Espagnol" },
  { code: "ar", nameEn: "Arabic", nameFr: "Arabe" },
  { code: "tl", nameEn: "Tagalog", nameFr: "Tagalog" },
  { code: "de", nameEn: "German", nameFr: "Allemand" },
  { code: "it", nameEn: "Italian", nameFr: "Italien" },
  { code: "pt", nameEn: "Portuguese", nameFr: "Portugais" },
  { code: "hi", nameEn: "Hindi", nameFr: "Hindi" },
  { code: "ru", nameEn: "Russian", nameFr: "Russe" },
  { code: "vi", nameEn: "Vietnamese", nameFr: "Vietnamien" },
  { code: "pl", nameEn: "Polish", nameFr: "Polonais" },
] as const;

export type LanguageLevel = "basic" | "conversational" | "fluent";

/** Years-of-experience bracket values stored in DB */
export const YEARS_EXPERIENCE_OPTIONS = [
  { value: 3, labelEn: "1–5 years", labelFr: "1–5 ans" },
  { value: 7, labelEn: "5–10 years", labelFr: "5–10 ans" },
  { value: 15, labelEn: "10–20 years", labelFr: "10–20 ans" },
  { value: 25, labelEn: "20+ years", labelFr: "20+ ans" },
] as const;

/** Weekday keys for availability (0 = Sunday, 1 = Monday, ... or we use Mon–Sun) */
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Get localized category name (EN from data, FR from map). */
export function getCategoryName(cat: { name: string; slug: string }, locale: "en" | "fr"): string {
  return locale === "fr" ? (SERVICE_CATEGORY_NAMES_FR[cat.slug] ?? cat.name) : cat.name;
}

/** French names for service categories (by slug). EN uses name from serviceCategories. */
export const SERVICE_CATEGORY_NAMES_FR: Record<string, string> = {
  "home-improvement": "Rénovation domiciliaire",
  "outdoor-seasonal": "Plein air et saisonnier",
  "cleaning": "Nettoyage",
  "business": "Services aux entreprises",
  "events": "Événements et divertissement",
  "lessons": "Cours et tutorat",
  "pets": "Animaux",
  "wellness": "Mieux-être",
  "moving": "Déménagement et entreposage",
  "security-inspection": "Sécurité et inspection",
};
