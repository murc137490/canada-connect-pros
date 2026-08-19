import { supabase } from "@/integrations/supabase/client";
import { isPaidSubscriptionPlanId } from "@/lib/proTierFeatures";

/**
 * Keep only pro profile IDs that have an active paid plan (starter/growth/pro).
 * Hold / unpaid verified pros must not appear in client search or advertising lists.
 * Best-effort app filter (not a hard DB RLS guarantee).
 */
export async function filterAdvertiseableProIds(proIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(proIds.filter(Boolean))];
  const out = new Set<string>();
  if (unique.length === 0) return out;

  const { data: profiles, error } = await supabase
    .from("pro_profiles")
    .select("id, user_id, subscription_tier")
    .in("id", unique);

  if (error || !profiles?.length) return out;

  const userIds = [...new Set(profiles.map((p) => p.user_id).filter(Boolean))] as string[];
  const planByUser = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: subs } = await supabase
      .from("pro_subscriptions")
      .select("user_id, plan_id")
      .in("user_id", userIds);
    for (const row of subs ?? []) {
      const uid = (row as { user_id: string }).user_id;
      const plan = String((row as { plan_id?: string | null }).plan_id ?? "").toLowerCase();
      if (uid) planByUser.set(uid, plan);
    }
  }

  for (const p of profiles) {
    const id = (p as { id: string }).id;
    const uid = (p as { user_id?: string | null }).user_id;
    const subPlan = uid ? planByUser.get(uid) : undefined;
    const tier = String((p as { subscription_tier?: string | null }).subscription_tier ?? "").toLowerCase();
    const effective = subPlan && subPlan.length > 0 ? subPlan : tier;
    if (isPaidSubscriptionPlanId(effective)) out.add(id);
  }

  return out;
}
