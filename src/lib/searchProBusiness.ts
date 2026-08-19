import { supabase } from "@/integrations/supabase/client";
import { filterAdvertiseableProIds } from "@/lib/filterAdvertiseablePros";

export type ProBusinessSearchHit = {
  proProfileId: string;
  businessName: string;
  fullName: string | null;
  primaryCategorySlug: string | null;
  primaryServiceSlug: string | null;
};

function escapeIlike(q: string): string {
  return `%${q.replace(/%/g, "").replace(/_/g, "")}%`;
}

async function primaryServiceSlugFor(proProfileId: string, categorySlug: string | null): Promise<string | null> {
  if (!categorySlug) return null;
  const { data: svc } = await supabase
    .from("pro_services")
    .select("service_slug")
    .eq("pro_profile_id", proProfileId)
    .eq("category_slug", categorySlug)
    .limit(1)
    .maybeSingle();
  return (svc as { service_slug?: string } | null)?.service_slug?.trim() || null;
}

function hitFromProRow(
  proRow: { id: string; business_name?: string | null; user_id?: string | null; primary_category_slug?: string | null },
  fullName: string | null,
  primaryServiceSlug: string | null,
): ProBusinessSearchHit | null {
  const businessName = String(proRow.business_name ?? fullName ?? "").trim();
  if (!businessName) return null;
  return {
    proProfileId: proRow.id,
    businessName,
    fullName,
    primaryCategorySlug: proRow.primary_category_slug?.trim() || null,
    primaryServiceSlug,
  };
}

/** Match verified pros by company name or account display name (for hero / services search). */
export async function searchProsByBusinessOrName(query: string, limit = 8): Promise<ProBusinessSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const pattern = escapeIlike(q);
  const hits: ProBusinessSearchHit[] = [];
  const seen = new Set<string>();

  const pushHit = async (
    proRow: { id: string; business_name?: string | null; user_id?: string | null; primary_category_slug?: string | null },
    fullName: string | null,
  ) => {
    if (!proRow.id || seen.has(proRow.id)) return;
    const categorySlug = proRow.primary_category_slug?.trim() || null;
    const primaryServiceSlug = await primaryServiceSlugFor(proRow.id, categorySlug);
    const hit = hitFromProRow(proRow, fullName, primaryServiceSlug);
    if (!hit) return;
    seen.add(proRow.id);
    hits.push(hit);
  };

  const { data: byBusiness, error: bizErr } = await supabase
    .from("pro_profiles")
    .select("id, business_name, user_id, primary_category_slug")
    .eq("is_verified", true)
    .ilike("business_name", pattern)
    .limit(limit);

  if (!bizErr && byBusiness?.length) {
    const userIds = [...new Set(byBusiness.map((p) => p.user_id).filter(Boolean))] as string[];
    const nameByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      for (const row of profiles ?? []) {
        const uid = (row as { user_id: string }).user_id;
        const name = (row as { full_name?: string | null }).full_name?.trim();
        if (name) nameByUser.set(uid, name);
      }
    }
    for (const p of byBusiness) {
      await pushHit(p, nameByUser.get(p.user_id as string) ?? null);
      if (hits.length >= limit) return hits;
    }
  }

  const { data: profileHits } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .ilike("full_name", pattern)
    .limit(limit);

  for (const prof of profileHits ?? []) {
    if (hits.length >= limit) break;
    const userId = (prof as { user_id: string }).user_id;
    const fullName = (prof as { full_name?: string | null }).full_name?.trim();
    if (!fullName) continue;
    const { data: proRow } = await supabase
      .from("pro_profiles")
      .select("id, business_name, user_id, primary_category_slug")
      .eq("user_id", userId)
      .eq("is_verified", true)
      .maybeSingle();
    if (!proRow?.id) continue;
    await pushHit(proRow, fullName);
  }

  const allowed = await filterAdvertiseableProIds(hits.map((h) => h.proProfileId));
  return hits.filter((h) => allowed.has(h.proProfileId)).slice(0, limit);
}
