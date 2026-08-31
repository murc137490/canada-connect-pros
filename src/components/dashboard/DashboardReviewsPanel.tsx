import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import StarRating from "@/components/pro/StarRating";
import BlurredReviewContent from "@/components/reviews/BlurredReviewContent";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  shouldBlurClientReviewOfProForViewer,
  shouldBlurProReviewOfClientForViewer,
} from "@/lib/reviewBlind";
import { REVIEWS_CHANGED_EVENT } from "@/lib/fetchPendingReviewNotices";
import {
  fetchAllReviewOpportunities,
  type ReviewOpportunity,
} from "@/lib/fetchReviewOpportunities";

type ReceivedFromPro = {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  pro_profile_id: string;
  booking_id: string | null;
  business_name: string | null;
  photo_urls: string[];
  blurred: boolean;
};

type GivenToPro = {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  pro_profile_id: string;
  business_name: string | null;
};

type ReceivedFromClient = {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string | null;
  blurred: boolean;
  reviewBookingId: string | null;
};

type GivenToClient = {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  client_id: string;
  client_name: string | null;
  photo_urls: string[];
};

function ReviewCard({
  rating,
  content,
  title,
  subtitle,
  date,
  photos,
  blurred,
  blurMessage,
  blurCtaLabel,
  blurCtaHref,
  onBlurCtaClick,
  blurMinHeightClass,
  reply,
}: {
  rating: number;
  content?: string | null;
  title?: string | null;
  subtitle: ReactNode;
  date: string;
  photos?: string[];
  blurred?: boolean;
  blurMessage?: string;
  blurCtaLabel?: string;
  blurCtaHref?: string;
  onBlurCtaClick?: () => void;
  blurMinHeightClass?: string;
  reply?: { rating: number; title?: string | null; content?: string | null; date: string } | null;
}) {
  const { t } = useLanguage();
  const body = (
    <>
      {title ? <p className="font-semibold text-foreground text-xs">{title}</p> : null}
      {content ? <p className="text-muted-foreground text-xs">{content}</p> : null}
      {photos && photos.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {photos.map((url) => (
            <img key={url} src={url} alt="" className="h-14 w-14 rounded-md object-cover border border-border/60" />
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {blurred ? (
          <span className="text-xs font-medium text-muted-foreground">
            {t.reviews?.hiddenUntilYouReview ?? "Hidden until you review"}
          </span>
        ) : (
          <StarRating rating={rating} size={14} />
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(date).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </span>
      </div>
      <p className="font-medium text-foreground">{subtitle}</p>
      {blurred && blurMessage ? (
        <BlurredReviewContent
          blurred
          message={blurMessage}
          ctaLabel={blurCtaLabel}
          ctaHref={onBlurCtaClick ? undefined : blurCtaHref}
          onCtaClick={onBlurCtaClick}
          minHeightClass={blurMinHeightClass}
          className="mt-1"
        >
          {body}
        </BlurredReviewContent>
      ) : (
        body
      )}
      {reply ? (
        <div className="ml-3 border-l-2 border-primary/30 pl-3 pt-2 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t.dashboard.reviewsYourReply ?? "Your review"}
          </p>
          <StarRating rating={reply.rating} size={12} />
          {reply.title ? <p className="font-semibold text-foreground text-xs">{reply.title}</p> : null}
          {reply.content ? <p className="text-muted-foreground text-xs">{reply.content}</p> : null}
          <p className="text-[10px] text-muted-foreground">
            {new Date(reply.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </p>
        </div>
      ) : null}
    </li>
  );
}

export default function DashboardReviewsPanel({
  proProfileId,
  showProSection,
  onReviewClient,
  onReviewPro,
}: {
  proProfileId: string | null;
  showProSection: boolean;
  onReviewClient?: (bookingId: string, clientId: string) => void;
  /** Opens in-dashboard form for the client to review a pro (do not navigate away). */
  onReviewPro?: (proProfileId: string) => void;
}) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [pendingAsClient, setPendingAsClient] = useState<ReviewOpportunity[]>([]);
  const [pendingAsPro, setPendingAsPro] = useState<ReviewOpportunity[]>([]);
  const [receivedFromPros, setReceivedFromPros] = useState<ReceivedFromPro[]>([]);
  const [givenToPros, setGivenToPros] = useState<GivenToPro[]>([]);
  const [receivedFromClients, setReceivedFromClients] = useState<ReceivedFromClient[]>([]);
  const [givenToClients, setGivenToClients] = useState<GivenToClient[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [givenAsProOpen, setGivenAsProOpen] = useState(false);

  useEffect(() => {
    const onReviewsChanged = () => setRefreshKey((k) => k + 1);
    window.addEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const uid = user.id;

      const opportunitiesPromise = fetchAllReviewOpportunities(uid, showProSection && proProfileId ? proProfileId : null);

      const receivedSelect =
        "id, rating, content, created_at, pro_profile_id, booking_id, photo_urls";
      const receivedFallback = "id, rating, content, created_at, pro_profile_id, booking_id";

      let receivedRes = await supabase
        .from("client_reviews")
        .select(receivedSelect)
        .eq("client_id", uid)
        .order("created_at", { ascending: false });
      if (receivedRes.error?.message?.includes("photo_urls")) {
        receivedRes = await supabase
          .from("client_reviews")
          .select(receivedFallback)
          .eq("client_id", uid)
          .order("created_at", { ascending: false });
      }

      const myReviewsRes = await supabase
        .from("reviews")
        .select("id, pro_profile_id, reviewer_id, rating, title, content, created_at, booking_id")
        .eq("reviewer_id", uid)
        .order("created_at", { ascending: false });

      const givenSelect = "id, rating, content, created_at, client_id, photo_urls";
      const givenFallback = "id, rating, content, created_at, client_id";
      let givenRes: {
        data: {
          id: string;
          rating: number;
          content: string | null;
          created_at: string;
          client_id: string;
          photo_urls?: string[] | null;
        }[] | null;
      } = { data: [] };

      let receivedOnProfileRes: { data: { id: string; rating: number; title: string | null; content: string | null; created_at: string; reviewer_id: string }[] | null } = {
        data: [],
      };
      let proClientReviewsGiven: { client_id: string; pro_profile_id: string }[] = [];
      let proUserId: string | null = null;

      if (showProSection && proProfileId) {
        const [givenClientRes, onProfileRes, clientReviewsGivenRes, proRow] = await Promise.all([
          supabase
            .from("client_reviews")
            .select(givenSelect)
            .eq("pro_profile_id", proProfileId)
            .order("created_at", { ascending: false }),
          supabase
            .from("reviews")
            .select("id, rating, title, content, created_at, reviewer_id")
            .eq("pro_profile_id", proProfileId)
            .order("created_at", { ascending: false }),
          supabase.from("client_reviews").select("client_id, pro_profile_id").eq("pro_profile_id", proProfileId),
          supabase.from("pro_profiles").select("user_id").eq("id", proProfileId).maybeSingle(),
        ]);
        givenRes = givenClientRes;
        if (givenRes.error?.message?.includes("photo_urls")) {
          givenRes = await supabase
            .from("client_reviews")
            .select(givenFallback)
            .eq("pro_profile_id", proProfileId)
            .order("created_at", { ascending: false });
        }
        receivedOnProfileRes = onProfileRes;
        proClientReviewsGiven = (clientReviewsGivenRes.data ?? []) as { client_id: string; pro_profile_id: string }[];
        proUserId = proRow.data?.user_id ?? null;
      }

      const { asClient, asPro } = await opportunitiesPromise;

      const myReviews = (myReviewsRes.data ?? []) as {
        id: string;
        pro_profile_id: string;
        reviewer_id: string;
        rating: number;
        title: string | null;
        content: string | null;
        created_at: string;
      }[];
      const receivedRows = receivedRes.data ?? [];
      const proIds = [
        ...new Set([
          ...receivedRows.map((r) => r.pro_profile_id),
          ...myReviews.map((r) => r.pro_profile_id),
        ]),
      ];
      const proNames = new Map<string, string>();
      if (proIds.length > 0) {
        const { data: pros } = await supabase.from("pro_profiles").select("id, business_name").in("id", proIds);
        (pros ?? []).forEach((p: { id: string; business_name: string | null }) => {
          proNames.set(p.id, p.business_name ?? "");
        });
      }

      const clientIds = [...new Set((givenRes.data ?? []).map((r) => r.client_id))];
      const reviewerIds = [...new Set((receivedOnProfileRes.data ?? []).map((r) => r.reviewer_id))];
      const allProfileIds = [...new Set([...clientIds, ...reviewerIds])];
      const personNames = new Map<string, string>();
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", allProfileIds);
        (profiles ?? []).forEach((p: { user_id: string; full_name: string | null }) => {
          personNames.set(p.user_id, p.full_name ?? "");
        });
      }

      const bookingByClient = new Map(asPro.map((o) => [o.clientId, o.bookingId]));

      if (cancelled) return;

      setPendingAsClient(asClient);
      setPendingAsPro(asPro);
      setReceivedFromPros(
        receivedRows.map((r) => {
          const blurred = shouldBlurProReviewOfClientForViewer(uid, uid, r.pro_profile_id, myReviews);
          return {
            id: r.id,
            rating: r.rating,
            content: r.content,
            created_at: r.created_at,
            pro_profile_id: r.pro_profile_id,
            booking_id: r.booking_id,
            business_name: proNames.get(r.pro_profile_id) ?? null,
            photo_urls: Array.isArray((r as { photo_urls?: string[] }).photo_urls)
              ? (r as { photo_urls: string[] }).photo_urls
              : [],
            blurred,
          };
        }),
      );
      setGivenToPros(
        myReviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          content: r.content,
          created_at: r.created_at,
          pro_profile_id: r.pro_profile_id,
          business_name: proNames.get(r.pro_profile_id) ?? null,
        })),
      );
      setReceivedFromClients(
        (receivedOnProfileRes.data ?? []).map((r) => {
          const blurred = shouldBlurClientReviewOfProForViewer(
            proUserId ?? undefined,
            proUserId ?? "",
            r.reviewer_id,
            proProfileId!,
            proClientReviewsGiven,
          );
          return {
            id: r.id,
            rating: r.rating,
            title: r.title,
            content: r.content,
            created_at: r.created_at,
            reviewer_id: r.reviewer_id,
            reviewer_name: personNames.get(r.reviewer_id) || null,
            blurred,
            reviewBookingId: bookingByClient.get(r.reviewer_id) ?? null,
          };
        }),
      );
      setGivenToClients(
        (givenRes.data ?? []).map((r) => ({
          id: r.id,
          rating: r.rating,
          content: r.content,
          created_at: r.created_at,
          client_id: r.client_id,
          client_name: personNames.get(r.client_id) || null,
          photo_urls: Array.isArray(r.photo_urls) ? r.photo_urls : [],
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, proProfileId, showProSection, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const blurMsgPro =
    t.reviews.blurredUntilYouReviewPro ?? "Leave your review to read theirs in full.";
  const blurMsgClient =
    t.reviews.blurredUntilYouReviewClient ??
    "Review this client to read their full review.";
  const blurCta = t.reviews.leaveReview ?? "Leave a review";
  const reviewClientCta = t.dashboard.reviewClient ?? "Review client";
  const pendingTitle = t.dashboard.reviewsPendingTitle ?? "Ready to review";
  const pendingHint =
    t.dashboard.reviewsPendingHint ??
    "After a completed booking, both sides can leave one review. You cannot read the other person's review until you submit yours.";
  const hasPending = pendingAsClient.length > 0 || pendingAsPro.length > 0;

  const givenToProsByProId = new Map(givenToPros.map((g) => [g.pro_profile_id, g]));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {hasPending ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 md:p-6 space-y-4">
          <h3 className="font-heading font-bold text-foreground">{pendingTitle}</h3>
          <p className="text-xs text-muted-foreground">{pendingHint}</p>
          <ul className="space-y-2">
            {pendingAsClient.map((o) => (
              <li
                key={`client-${o.proProfileId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm"
              >
                <span className="font-medium">
                  {(t.dashboard.reviewsPendingClientLine ?? "Review {{name}}").replace(
                    "{{name}}",
                    o.proBusinessName ?? t.dashboard.reviewTargetPro ?? "Professional",
                  )}
                </span>
                {onReviewPro ? (
                  <Button type="button" size="sm" onClick={() => onReviewPro(o.proProfileId)}>
                    {blurCta}
                  </Button>
                ) : (
                  <Button type="button" size="sm" asChild>
                    <Link to={`/pros/${o.proProfileId}#reviews`}>{blurCta}</Link>
                  </Button>
                )}
              </li>
            ))}
            {pendingAsPro.map((o) => (
              <li
                key={`pro-${o.clientId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm"
              >
                <span className="font-medium">
                  {(t.dashboard.reviewsPendingProLine ?? "Review {{name}}").replace(
                    "{{name}}",
                    o.clientName ?? t.dashboard.reviewTargetClient ?? "Client",
                  )}
                </span>
                {onReviewClient ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onReviewClient(o.bookingId, o.clientId)}
                  >
                    {reviewClientCta}
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <Link to="/dashboard?tab=bookings">{reviewClientCta}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showProSection ? (
        <>
          <div className="rounded-xl border bg-card p-5 md:p-6 space-y-4">
            <h3 className="font-heading font-bold text-foreground">{t.dashboard.reviewsReceivedAsPro}</h3>
            <p className="text-xs text-muted-foreground">{t.dashboard.reviewsAsProHint}</p>
            {receivedFromClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.dashboard.reviewsAsProEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {receivedFromClients.map((r) => (
                  <ReviewCard
                    key={r.id}
                    rating={r.rating}
                    title={r.title}
                    content={r.content}
                    date={r.created_at}
                    blurred={r.blurred}
                    blurMessage={blurMsgClient}
                    blurCtaLabel={reviewClientCta}
                    blurCtaHref={
                      r.blurred && !onReviewClient ? "/dashboard?tab=bookings" : undefined
                    }
                    onBlurCtaClick={
                      r.blurred && onReviewClient && r.reviewBookingId
                        ? () => onReviewClient(r.reviewBookingId!, r.reviewer_id)
                        : r.blurred && onReviewClient
                          ? () => {
                              const opp = pendingAsPro.find((o) => o.clientId === r.reviewer_id);
                              if (opp) onReviewClient(opp.bookingId, opp.clientId);
                            }
                          : undefined
                    }
                    blurMinHeightClass="min-h-[10rem]"
                    subtitle={r.reviewer_name ?? (t.dashboard.reviewFromClient ?? "Client")}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5 md:p-6 space-y-4">
            <h3 className="font-heading font-bold text-foreground">{t.dashboard.reviewsReceivedAsClient}</h3>
            <p className="text-xs text-muted-foreground">{t.dashboard.reviewsReceivedAsClientHint}</p>
            {receivedFromPros.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.dashboard.reviewsAsClientEmpty}</p>
            ) : (
              <ul className="space-y-2">
                {receivedFromPros.map((r) => {
                  const reply = givenToProsByProId.get(r.pro_profile_id);
                  return (
                    <ReviewCard
                      key={r.id}
                      rating={r.rating}
                      content={r.content}
                      date={r.created_at}
                      photos={r.photo_urls}
                      blurred={r.blurred}
                      blurMessage={blurMsgPro}
                      blurCtaLabel={blurCta}
                      blurCtaHref={
                        r.blurred && !onReviewPro ? `/pros/${r.pro_profile_id}#reviews` : undefined
                      }
                      onBlurCtaClick={
                        r.blurred && onReviewPro ? () => onReviewPro(r.pro_profile_id) : undefined
                      }
                      blurMinHeightClass="min-h-[10rem]"
                      subtitle={
                        r.business_name ? (
                          <Link to={`/pros/${r.pro_profile_id}`} className="text-primary hover:underline">
                            {r.business_name}
                          </Link>
                        ) : (
                          (t.dashboard.reviewFromPro ?? "From a professional")
                        )
                      }
                      reply={
                        reply
                          ? {
                              rating: reply.rating,
                              title: reply.title,
                              content: reply.content,
                              date: reply.created_at,
                            }
                          : null
                      }
                    />
                  );
                })}
              </ul>
            )}
          </div>

          {givenToClients.length > 0 ? (
            <Collapsible open={givenAsProOpen} onOpenChange={setGivenAsProOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full justify-between gap-2">
                  <span>{t.dashboard.reviewsGivenAsProCollapsed ?? "Reviews you gave about clients"}</span>
                  <span className="text-muted-foreground text-xs">({givenToClients.length})</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${givenAsProOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <ul className="space-y-2">
                  {givenToClients.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <StarRating rating={r.rating} size={14} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">
                        {r.client_name || (t.dashboard.reviewTargetClient ?? "Client")}
                      </p>
                      {r.content ? <p className="text-muted-foreground text-xs">{r.content}</p> : null}
                      {r.photo_urls.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.photo_urls.map((url) => (
                            <img key={url} src={url} alt="" className="h-14 w-14 rounded-md object-cover border border-border/60" />
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border bg-card p-5 md:p-6 space-y-4">
          <h3 className="font-heading font-bold text-foreground">{t.dashboard.reviewsReceivedAsClient}</h3>
          <p className="text-xs text-muted-foreground">{t.dashboard.reviewsReceivedAsClientHint}</p>
          {receivedFromPros.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dashboard.reviewsAsClientEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {receivedFromPros.map((r) => {
                const reply = givenToProsByProId.get(r.pro_profile_id);
                return (
                  <ReviewCard
                    key={r.id}
                    rating={r.rating}
                    content={r.content}
                    date={r.created_at}
                    photos={r.photo_urls}
                    blurred={r.blurred}
                    blurMessage={blurMsgPro}
                    blurCtaLabel={blurCta}
                    blurCtaHref={
                      r.blurred && !onReviewPro ? `/pros/${r.pro_profile_id}#reviews` : undefined
                    }
                    onBlurCtaClick={
                      r.blurred && onReviewPro ? () => onReviewPro(r.pro_profile_id) : undefined
                    }
                    blurMinHeightClass="min-h-[10rem]"
                    subtitle={
                      r.business_name ? (
                        <Link to={`/pros/${r.pro_profile_id}`} className="text-primary hover:underline">
                          {r.business_name}
                        </Link>
                      ) : (
                        (t.dashboard.reviewFromPro ?? "From a professional")
                      )
                    }
                    reply={
                      reply
                        ? {
                            rating: reply.rating,
                            title: reply.title,
                            content: reply.content,
                            date: reply.created_at,
                          }
                        : null
                    }
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
