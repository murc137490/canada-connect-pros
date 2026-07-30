import { supabase } from "@/integrations/supabase/client";

/** Client reviewing a pro — one review ever per pair (delete blocks re-submit). */
export async function canSubmitProReview(proProfileId: string, reviewerId: string): Promise<{ ok: true } | { ok: false; reason: "exists" | "locked" }> {
  const [{ data: existing }, { data: locked }] = await Promise.all([
    supabase.from("reviews").select("id").eq("pro_profile_id", proProfileId).eq("reviewer_id", reviewerId).maybeSingle(),
    supabase
      .from("review_submission_locks")
      .select("pro_profile_id")
      .eq("pro_profile_id", proProfileId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle(),
  ]);
  if (existing?.id) return { ok: false, reason: "exists" };
  if (locked?.pro_profile_id) return { ok: false, reason: "locked" };
  return { ok: true };
}

/** Pro reviewing a client — one review per pair. */
export async function canSubmitClientReview(
  proProfileId: string,
  clientId: string,
): Promise<{ ok: true } | { ok: false; reason: "exists" | "locked" }> {
  const [{ data: existing }, { data: locked }] = await Promise.all([
    supabase
      .from("client_reviews")
      .select("id")
      .eq("pro_profile_id", proProfileId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_review_submission_locks")
      .select("pro_profile_id")
      .eq("pro_profile_id", proProfileId)
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  if (existing?.id) return { ok: false, reason: "exists" };
  if (locked?.pro_profile_id) return { ok: false, reason: "locked" };
  return { ok: true };
}
