import { supabase } from "@/integrations/supabase/client";
import { clientUserHasReviewedPro, proHasReviewedClient } from "@/lib/reviewBlind";

export type ReviewOpportunity = {
  bookingId: string;
  completedAt: string;
  proProfileId: string;
  proBusinessName: string | null;
  clientId: string;
  clientName: string | null;
};

async function namesForPros(proIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (proIds.length === 0) return map;
  const { data } = await supabase.from("pro_profiles").select("id, business_name").in("id", proIds);
  (data ?? []).forEach((p: { id: string; business_name: string | null }) => {
    map.set(p.id, p.business_name?.trim() || "Professional");
  });
  return map;
}

async function namesForClients(clientIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (clientIds.length === 0) return map;
  const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", clientIds);
  (data ?? []).forEach((p: { user_id: string; full_name: string | null }) => {
    map.set(p.user_id, p.full_name?.trim() || "Client");
  });
  return map;
}

/** Completed bookings where the client has not yet reviewed that pro (one review per pair). */
export async function fetchClientReviewOpportunities(userId: string): Promise<ReviewOpportunity[]> {
  const [bookingsRes, myReviewsRes, locksRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, created_at, pro_profile_id, client_id")
      .eq("client_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase.from("reviews").select("pro_profile_id, reviewer_id").eq("reviewer_id", userId),
    supabase.from("review_submission_locks").select("pro_profile_id").eq("reviewer_id", userId),
  ]);

  const myReviews = (myReviewsRes.data ?? []) as { pro_profile_id: string; reviewer_id: string }[];
  const lockedProIds = new Set((locksRes.data ?? []).map((r: { pro_profile_id: string }) => r.pro_profile_id));
  const bookings = bookingsRes.data ?? [];
  const seenPro = new Set<string>();
  const proIds: string[] = [];

  const pending: { bookingId: string; completedAt: string; proProfileId: string; clientId: string }[] = [];
  for (const b of bookings) {
    if (seenPro.has(b.pro_profile_id) || lockedProIds.has(b.pro_profile_id)) continue;
    if (clientUserHasReviewedPro(b.pro_profile_id, userId, myReviews)) continue;
    seenPro.add(b.pro_profile_id);
    proIds.push(b.pro_profile_id);
    pending.push({
      bookingId: b.id,
      completedAt: b.created_at,
      proProfileId: b.pro_profile_id,
      clientId: b.client_id,
    });
  }

  const proNames = await namesForPros(proIds);
  return pending.map((p) => ({
    ...p,
    proBusinessName: proNames.get(p.proProfileId) ?? null,
    clientName: null,
  }));
}

/** Completed bookings where the pro has not yet reviewed that client. */
export async function fetchProReviewOpportunities(
  proProfileId: string,
): Promise<ReviewOpportunity[]> {
  const [bookingsRes, givenRes, locksRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, created_at, pro_profile_id, client_id")
      .eq("pro_profile_id", proProfileId)
      .eq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase.from("client_reviews").select("client_id, pro_profile_id").eq("pro_profile_id", proProfileId),
    supabase
      .from("client_review_submission_locks")
      .select("client_id")
      .eq("pro_profile_id", proProfileId),
  ]);

  const given = (givenRes.data ?? []) as { client_id: string; pro_profile_id: string }[];
  const lockedClientIds = new Set((locksRes.data ?? []).map((r: { client_id: string }) => r.client_id));
  const bookings = bookingsRes.data ?? [];
  const seenClient = new Set<string>();
  const clientIds: string[] = [];

  const pending: { bookingId: string; completedAt: string; proProfileId: string; clientId: string }[] = [];
  for (const b of bookings) {
    if (seenClient.has(b.client_id) || lockedClientIds.has(b.client_id)) continue;
    if (proHasReviewedClient(proProfileId, b.client_id, given)) continue;
    seenClient.add(b.client_id);
    clientIds.push(b.client_id);
    pending.push({
      bookingId: b.id,
      completedAt: b.created_at,
      proProfileId: b.pro_profile_id,
      clientId: b.client_id,
    });
  }

  const clientNames = await namesForClients(clientIds);
  return pending.map((p) => ({
    ...p,
    proBusinessName: null,
    clientName: clientNames.get(p.clientId) ?? null,
  }));
}

export async function fetchAllReviewOpportunities(
  userId: string,
  proProfileId: string | null,
): Promise<{ asClient: ReviewOpportunity[]; asPro: ReviewOpportunity[] }> {
  const [asClient, asPro] = await Promise.all([
    fetchClientReviewOpportunities(userId),
    proProfileId ? fetchProReviewOpportunities(proProfileId) : Promise.resolve([]),
  ]);
  return { asClient, asPro };
}
