import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import StarRating from "./StarRating";
import ReviewForm from "./ReviewForm";
import StorageDisplayImage from "@/components/StorageDisplayImage";
import { canSubmitProReview } from "@/lib/reviewGuards";
import { shouldBlurClientReviewOfProForViewer } from "@/lib/reviewBlind";
import { REVIEWS_CHANGED_EVENT } from "@/lib/fetchPendingReviewNotices";
import BlurredReviewContent from "@/components/reviews/BlurredReviewContent";

interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string | null;
  photos: { id: string; url: string }[];
  response: { id: string; content: string; created_at: string } | null;
}

interface ReviewSectionProps {
  proProfileId: string;
  proUserId: string;
  /** When set, show only this many reviews and a "View all" link (for preview block). */
  previewLimit?: number;
  /** Id to scroll to for "View all reviews" link. */
  scrollToId?: string;
}

export default function ReviewSection({ proProfileId, proUserId, previewLimit, scrollToId = "reviews" }: ReviewSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [hasBookingWithPro, setHasBookingWithPro] = useState<boolean | null>(null);
  const [reviewBlocked, setReviewBlocked] = useState<"none" | "exists" | "locked">("none");
  const [proClientReviewsGiven, setProClientReviewsGiven] = useState<{ client_id: string }[]>([]);

  const fetchReviews = async () => {
    setLoading(true);
    const [{ data: reviewData }, { data: clientReviewsGiven }] = await Promise.all([
      supabase
        .from("reviews")
        .select("*")
        .eq("pro_profile_id", proProfileId)
        .order("created_at", { ascending: false }),
      supabase.from("client_reviews").select("client_id").eq("pro_profile_id", proProfileId),
    ]);
    setProClientReviewsGiven(clientReviewsGiven ?? []);

    if (!reviewData) { setLoading(false); return; }

    const enriched: Review[] = [];
    for (const r of reviewData) {
      // Get reviewer name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", r.reviewer_id)
        .single();

      // Get photos
      const { data: photos } = await supabase
        .from("review_photos")
        .select("id, url")
        .eq("review_id", r.id);

      // Get response
      const { data: response } = await supabase
        .from("review_responses")
        .select("id, content, created_at")
        .eq("review_id", r.id)
        .single();

      enriched.push({
        ...r,
        reviewer_name: profile?.full_name || "Anonymous",
        photos: photos || [],
        response: response || null,
      });
    }

    setReviews(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [proProfileId]);

  const refreshReviewEligibility = async () => {
    if (!user || !proProfileId) {
      setHasBookingWithPro(null);
      setReviewBlocked("none");
      return;
    }
    const [{ data: booking }, guard] = await Promise.all([
      supabase
        .from("bookings")
        .select("id")
        .eq("pro_profile_id", proProfileId)
        .eq("client_id", user.id)
        .eq("status", "completed")
        .limit(1),
      canSubmitProReview(proProfileId, user.id),
    ]);
    setHasBookingWithPro((booking?.length ?? 0) > 0);
    if (!guard.ok) setReviewBlocked(guard.reason);
    else setReviewBlocked("none");
  };

  useEffect(() => {
    void refreshReviewEligibility();
  }, [user, proProfileId]);

  useEffect(() => {
    const onReviewsChanged = () => {
      void fetchReviews();
      void refreshReviewEligibility();
    };
    window.addEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
  }, [user, proProfileId]);

  const handleReviewSubmitted = () => {
    setReviewBlocked("exists");
    void fetchReviews();
    void refreshReviewEligibility();
  };

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return;
    setSubmittingResponse(true);
    try {
      const { error } = await supabase.from("review_responses").insert({
        review_id: reviewId,
        pro_user_id: user!.id,
        content: responseText.trim(),
      });
      if (error) throw error;
      toast({ title: t.reviews.responseAdded });
      setRespondingTo(null);
      setResponseText("");
      fetchReviews();
    } catch (err: any) {
      toast({ title: t.auth.toastError, description: err.message, variant: "destructive" });
    } finally {
      setSubmittingResponse(false);
    }
  };

  const isProOwner = user?.id === proUserId;
  const alreadyReviewedInList = Boolean(user && reviews.some((r) => r.reviewer_id === user.id));
  const formBlocked: "none" | "exists" | "locked" =
    reviewBlocked !== "none" ? reviewBlocked : alreadyReviewedInList ? "exists" : "none";

  const displayReviews = previewLimit != null ? reviews.slice(0, previewLimit) : reviews;

  return (
    <div className="space-y-2.5 text-[0.6rem] sm:text-[0.62rem]" id={previewLimit == null ? scrollToId : undefined}>
      <h2 className="font-heading text-[0.72rem] font-bold text-foreground leading-tight">
        {t.reviews.sectionTitle} ({reviews.length})
      </h2>

      {/* Review form only for preview: hide; for full section: show if user has booking */}
      {previewLimit == null && user && !isProOwner && hasBookingWithPro === true && formBlocked === "none" && (
        <ReviewForm proProfileId={proProfileId} onSubmitted={handleReviewSubmitted} />
      )}
      {previewLimit == null && user && !isProOwner && hasBookingWithPro === true && formBlocked !== "none" && (
        <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-3 py-2">
          {formBlocked === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="animate-spin text-muted-foreground" size={14} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-3 text-muted-foreground leading-snug">
          {hasBookingWithPro === true ? t.reviews.noReviewsYetFirst : t.reviews.noReviewsYet}
        </div>
      ) : (
        <div className="space-y-2">
          {displayReviews.map((review) => {
            const initials = review.reviewer_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?";
            const proClientPairs = proClientReviewsGiven.map((r) => ({
              pro_profile_id: proProfileId,
              client_id: r.client_id,
            }));
            const blurredForViewer = shouldBlurClientReviewOfProForViewer(
              user?.id,
              proUserId,
              review.reviewer_id,
              proProfileId,
              proClientPairs,
            );

            return (
              <div key={review.id} className="bg-card border rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarFallback className="text-[0.55rem] leading-none bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-card-foreground text-[0.65rem]">
                        {review.reviewer_name}
                      </span>
                      <StarRating rating={review.rating} size={9} />
                    </div>
                    <p className="text-[0.55rem] text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {(() => {
                  const reviewBody = (
                    <>
                      {review.title && (
                        <h4 className="font-semibold text-card-foreground text-[0.65rem] leading-snug">{review.title}</h4>
                      )}
                      {review.content && (
                        <p className="text-[0.6rem] text-muted-foreground leading-snug">{review.content}</p>
                      )}
                      {review.photos.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {review.photos.map((photo) => (
                            <StorageDisplayImage
                              key={photo.id}
                              bucket="review-photos"
                              url={photo.url}
                              alt="Review photo"
                              className="w-14 h-14 rounded-md object-cover border"
                            />
                          ))}
                        </div>
                      )}
                    </>
                  );
                  return (
                    <BlurredReviewContent
                      blurred={blurredForViewer}
                      message={
                        t.reviews.blurredUntilYouReviewClient ??
                        "Review this client to read their full review."
                      }
                      ctaLabel={t.dashboard.reviewClient ?? "Review client"}
                      ctaHref="/dashboard?tab=reviews"
                      minHeightClass="min-h-[8rem]"
                    >
                      {reviewBody}
                    </BlurredReviewContent>
                  );
                })()}

                {/* Pro response */}
                {review.response && !blurredForViewer && (
                  <div className="ml-3 bg-muted/50 border rounded-md p-2">
                    <p className="text-[0.55rem] font-semibold text-muted-foreground mb-0.5">
                      {t.reviews.responseFromPro}
                    </p>
                    <p className="text-[0.6rem] text-card-foreground leading-snug">{review.response.content}</p>
                  </div>
                )}

                {/* Respond button for pro */}
                {isProOwner && !review.response && !blurredForViewer && (
                  <>
                    {respondingTo === review.id ? (
                      <div className="ml-3 space-y-1">
                        <Textarea
                          placeholder={t.reviews.writeResponse}
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="text-[0.6rem] min-h-[2.5rem] py-1"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="h-6 text-[0.55rem] px-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                            onClick={() => handleRespond(review.id)}
                            disabled={submittingResponse}
                          >
                            {submittingResponse ? <Loader2 className="animate-spin" size={10} /> : t.reviews.postResponse}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[0.55rem] px-2" onClick={() => setRespondingTo(null)}>
                            {t.common.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-3 gap-0.5 text-muted-foreground h-6 text-[0.55rem] px-2"
                        onClick={() => setRespondingTo(review.id)}
                      >
                        <MessageSquare size={10} /> {t.reviews.respond}
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {previewLimit != null && reviews.length > previewLimit && (
            <a
              href={`#${scrollToId}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-block text-[0.6rem] font-medium text-primary hover:underline mt-1"
            >
              {t.reviews?.viewAll ?? "View all"} {reviews.length} {reviews.length === 1 ? (t.common?.review ?? "review") : (t.common?.reviews ?? "reviews")} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
