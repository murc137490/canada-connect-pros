/**
 * Two-way blind reviews per pro + client pair:
 * - Client → pro: `reviews` (public on pro page)
 * - Pro → client: `client_reviews` (client dashboard)
 *
 * Reviews exist in the database immediately; the party who has not submitted
 * their side yet sees a blurred placeholder until both sides have posted.
 */

/** One review per client + pro pair (see reviewGuards); booking_id is not used for reveal. */
export function clientUserHasReviewedPro(
  proProfileId: string,
  clientUserId: string,
  reviewsOnPro: { pro_profile_id: string; reviewer_id: string }[],
): boolean {
  return reviewsOnPro.some(
    (r) => r.pro_profile_id === proProfileId && r.reviewer_id === clientUserId,
  );
}

export function proHasReviewedClient(
  proProfileId: string,
  clientId: string,
  proClientReviews: { pro_profile_id: string; client_id: string }[],
): boolean {
  return proClientReviews.some(
    (r) => r.pro_profile_id === proProfileId && r.client_id === clientId,
  );
}

/** @deprecated use clientUserHasReviewedPro */
export function clientHasSubmittedProReview(
  proProfileId: string,
  _bookingId: string | null | undefined,
  myProReviews: { pro_profile_id: string; reviewer_id?: string; booking_id?: string | null }[],
): boolean {
  return myProReviews.some((r) => r.pro_profile_id === proProfileId);
}

/** Client viewing pro's review of them — blur until they reviewed that pro. */
export function shouldBlurProReviewOfClientForViewer(
  viewerId: string | undefined,
  clientIdOnReview: string,
  proProfileId: string,
  allMyReviewsOfPros: { pro_profile_id: string; reviewer_id: string }[],
): boolean {
  if (!viewerId || viewerId !== clientIdOnReview) return false;
  return !clientUserHasReviewedPro(proProfileId, viewerId, allMyReviewsOfPros);
}

/** Pro owner viewing a client's public review — blur until pro reviewed that client. */
export function shouldBlurClientReviewOfProForViewer(
  viewerId: string | undefined,
  proUserId: string,
  reviewerId: string,
  proProfileId: string,
  proClientReviews: { pro_profile_id: string; client_id: string; booking_id?: string | null }[],
): boolean {
  if (!viewerId || viewerId !== proUserId) return false;
  if (viewerId === reviewerId) return false;
  return !proHasReviewedClient(proProfileId, reviewerId, proClientReviews);
}
