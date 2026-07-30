import { supabase } from "@/integrations/supabase/client";
import { clientUserHasReviewedPro, proHasReviewedClient } from "@/lib/reviewBlind";
import { fetchAllReviewOpportunities } from "@/lib/fetchReviewOpportunities";

export type PendingReviewNotice = {
  id: string;
  created_at: string;
  label: string;
};

export const REVIEWS_CHANGED_EVENT = "premiere-reviews-changed";

export function notifyReviewsChanged(): void {
  window.dispatchEvent(new CustomEvent(REVIEWS_CHANGED_EVENT));
}

export async function fetchPendingReviewNotices(opts: {
  userId: string;
  proProfileId: string | null;
  labels: {
    clientLine: (proName: string) => string;
    proLine: (clientName: string) => string;
    clientDueLine?: (proName: string) => string;
    proDueLine?: (clientName: string) => string;
  };
}): Promise<PendingReviewNotice[]> {
  const { userId, proProfileId, labels } = opts;
  const notices: PendingReviewNotice[] = [];
  const waitingProIds = new Set<string>();
  const waitingClientIds = new Set<string>();

  const [receivedRes, myReviewsRes] = await Promise.all([
    supabase
      .from("client_reviews")
      .select("id, created_at, pro_profile_id, booking_id")
      .eq("client_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("reviews").select("pro_profile_id, reviewer_id, booking_id").eq("reviewer_id", userId),
  ]);

  const myReviews = (myReviewsRes.data ?? []) as {
    pro_profile_id: string;
    reviewer_id: string;
    booking_id?: string | null;
  }[];
  const received = receivedRes.data ?? [];
  const proIds = [...new Set(received.map((r) => r.pro_profile_id))];
  const proNames = new Map<string, string>();
  if (proIds.length > 0) {
    const { data: pros } = await supabase.from("pro_profiles").select("id, business_name").in("id", proIds);
    (pros ?? []).forEach((p: { id: string; business_name: string | null }) => {
      proNames.set(p.id, p.business_name?.trim() || "Professional");
    });
  }

  for (const r of received) {
    if (clientUserHasReviewedPro(r.pro_profile_id, userId, myReviews)) continue;
    const name = proNames.get(r.pro_profile_id) ?? "Professional";
    waitingProIds.add(r.pro_profile_id);
    notices.push({
      id: `review-waiting-client-${r.id}`,
      created_at: r.created_at,
      label: labels.clientLine(name),
    });
  }

  if (proProfileId) {
    const [onProfileRes, givenRes] = await Promise.all([
      supabase
        .from("reviews")
        .select("id, created_at, reviewer_id")
        .eq("pro_profile_id", proProfileId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("client_reviews").select("client_id, pro_profile_id").eq("pro_profile_id", proProfileId),
    ]);
    const onProfile = onProfileRes.data ?? [];
    const given = (givenRes.data ?? []) as { client_id: string; pro_profile_id: string }[];
    const clientIds = [...new Set(onProfile.map((r) => r.reviewer_id))];
    const clientNames = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds);
      (profiles ?? []).forEach((p: { user_id: string; full_name: string | null }) => {
        clientNames.set(p.user_id, p.full_name?.trim() || "Client");
      });
    }
    for (const r of onProfile) {
      if (proHasReviewedClient(proProfileId, r.reviewer_id, given)) continue;
      const name = clientNames.get(r.reviewer_id) ?? "Client";
      waitingClientIds.add(r.reviewer_id);
      notices.push({
        id: `review-waiting-pro-${r.id}`,
        created_at: r.created_at,
        label: labels.proLine(name),
      });
    }
  }

  if (labels.clientDueLine || labels.proDueLine) {
    const { asClient, asPro } = await fetchAllReviewOpportunities(userId, proProfileId);
    for (const o of asClient) {
      if (waitingProIds.has(o.proProfileId)) continue;
      const name = o.proBusinessName ?? "Professional";
      notices.push({
        id: `review-due-client-${o.proProfileId}`,
        created_at: o.completedAt,
        label: (labels.clientDueLine ?? labels.clientLine)(name),
      });
    }
    for (const o of asPro) {
      if (waitingClientIds.has(o.clientId)) continue;
      const name = o.clientName ?? "Client";
      notices.push({
        id: `review-due-pro-${o.clientId}`,
        created_at: o.completedAt,
        label: (labels.proDueLine ?? labels.proLine)(name),
      });
    }
  }

  return notices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
