import { supabase } from "@/integrations/supabase/client";
import type { Locale } from "@/i18n/translations";
import { serviceCategories, buildAiEmbedTextForServiceSlug, type ServiceRecordForAI } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";

const MAX_PRO_IDS = 1500;
const MAX_ROWS = 800;

function categoryMeta(categorySlug: string) {
  const cat = serviceCategories.find((c) => c.slug === categorySlug);
  return cat ?? { name: categorySlug, slug: categorySlug, subcategories: [] as { name: string; services: { slug: string; name: string }[] }[] };
}

/**
 * Distinct catalog-backed services as pros list them (display_name when set),
 * for hero "You might also consider" — same slugs/routes as today, richer labels from pros.
 */
export async function fetchProOfferedServiceRecordsForHero(locale: Locale): Promise<ServiceRecordForAI[]> {
  const { data: pros, error: pErr } = await supabase
    .from("pro_profiles")
    .select("id")
    .eq("is_verified", true)
    .limit(MAX_PRO_IDS);
  if (pErr || !pros?.length) return [];

  const ids = [...new Set(pros.map((r: { id: string }) => r.id))];
  const CHUNK = 200;
  const allRows: { category_slug: string; service_slug: string; display_name: string | null }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data: part, error: sErr } = await supabase
      .from("pro_services")
      .select("category_slug, service_slug, display_name")
      .in("pro_profile_id", chunk)
      .limit(MAX_ROWS);
    if (sErr) continue;
    allRows.push(...((part ?? []) as typeof allRows));
    if (allRows.length >= MAX_ROWS) break;
  }

  if (!allRows.length) return [];

  const seen = new Set<string>();
  const out: ServiceRecordForAI[] = [];

  for (const row of allRows) {
    const rawName = row.display_name?.trim();
    if (!rawName) continue;

    const cat = categoryMeta(row.category_slug);
    const categoryName = getCategoryName(cat, locale);
    const catalogFallbackEn = (() => {
      for (const sub of cat.subcategories ?? []) {
        const svc = sub.services.find((s) => s.slug === row.service_slug);
        if (svc) return svc.name;
      }
      return row.service_slug.replace(/-/g, " ");
    })();
    const localizedCatalog = getServiceName(row.service_slug, locale, catalogFallbackEn);
    if (localizedCatalog.trim().toLowerCase() === rawName.toLowerCase()) continue;

    const chipName = rawName;
    const dedupeKey = `${row.category_slug}/${row.service_slug}/${chipName.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const subName = (() => {
      for (const sub of cat.subcategories ?? []) {
        if (sub.services.some((s) => s.slug === row.service_slug)) return sub.name;
      }
      return "";
    })();

    out.push({
      name: chipName,
      slug: row.service_slug,
      categorySlug: row.category_slug,
      categoryName,
      subcategory: subName,
      embedText: buildAiEmbedTextForServiceSlug(row.service_slug, chipName),
    });
  }

  return out;
}
