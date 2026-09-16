import { supabase } from "@/integrations/supabase/client";
import {
  isReservedShareSlug,
  slugifyShareName,
  suggestAlternateShareSlugs,
} from "@/lib/proShareSlug";

/**
 * True if another pro already claims this vanity slug
 * (explicit share_slug, or slugified business / full name).
 */
export async function isShareSlugTaken(
  slug: string,
  exceptProId?: string | null,
): Promise<boolean> {
  const needle = slugifyShareName(slug);
  if (!needle || isReservedShareSlug(needle)) return true;

  const { data: bySlug } = await supabase
    .from("pro_profiles")
    .select("id")
    .ilike("share_slug", needle)
    .limit(5);

  if ((bySlug ?? []).some((r) => r.id !== exceptProId)) return true;

  const { data: byBusiness } = await supabase
    .from("pro_profiles")
    .select("id, business_name")
    .neq("id", exceptProId ?? "00000000-0000-0000-0000-000000000000")
    .limit(500);

  for (const row of byBusiness ?? []) {
    if (slugifyShareName(row.business_name ?? "") === needle) return true;
  }

  const { data: byName } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .not("full_name", "is", null)
    .limit(800);

  if (byName?.length) {
    const userIds = byName
      .filter((p) => slugifyShareName(p.full_name ?? "") === needle)
      .map((p) => p.user_id);
    if (userIds.length) {
      const { data: pros } = await supabase
        .from("pro_profiles")
        .select("id, user_id")
        .in("user_id", userIds);
      if ((pros ?? []).some((p) => p.id !== exceptProId)) return true;
    }
  }

  return false;
}

/** Preferred slug + two alternates when the preferred one is taken. */
export async function resolveShareSlugChoices(
  businessName: string,
  exceptProId?: string | null,
): Promise<{ preferred: string; taken: boolean; alternatives: [string, string] }> {
  const preferred = slugifyShareName(businessName);
  const taken = await isShareSlugTaken(preferred, exceptProId);
  let alternatives = suggestAlternateShareSlugs(preferred, exceptProId ?? "");
  // Ensure alternatives are free
  for (let i = 0; i < 2; i++) {
    let guard = 0;
    while ((await isShareSlugTaken(alternatives[i], exceptProId)) && guard < 12) {
      const [next] = suggestAlternateShareSlugs(`${preferred}${guard + 3}`, `${exceptProId}-${guard}`);
      alternatives = i === 0 ? [next, alternatives[1]] : [alternatives[0], next];
      guard++;
    }
  }
  return { preferred, taken, alternatives };
}
