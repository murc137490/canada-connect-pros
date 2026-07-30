import type { Locale } from "@/i18n/translations";
import { getServiceName } from "@/i18n/serviceTranslations";

/** Public label: personalized `display_name` when set, else catalog `getServiceName`. */
export function labelProService(
  row: { service_slug: string; display_name?: string | null },
  locale: Locale,
  catalogNameEn: string
): string {
  const d = row.display_name?.trim();
  if (d) return d;
  return getServiceName(row.service_slug, locale, catalogNameEn);
}

export function catalogEnNameForProService(categorySlug: string, serviceSlug: string, categories: { slug: string; subcategories: { services: { slug: string; name: string }[] }[] }[]): string {
  const cat = categories.find((c) => c.slug === categorySlug);
  for (const sub of cat?.subcategories ?? []) {
    const s = sub.services.find((x) => x.slug === serviceSlug);
    if (s) return s.name;
  }
  return serviceSlug.replace(/-/g, " ");
}
