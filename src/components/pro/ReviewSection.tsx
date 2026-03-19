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

  const fetchReviews = async () => {
    setLoading(true);
    const { data: reviewData } = await supabase
      .from("reviews")
      .select("*")
      .eq("pro_profile_id", proProfileId)
      .order("created_at", { ascending: false });

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

  useEffect(() => {
    if (!user || !proProfileId) { setHasBookingWithPro(null); return; }
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id")
        .eq("pro_profile_id", proProfileId)
        .eq("client_id", user.id)
        .eq("status", "completed")
        .limit(1);
      setHasBookingWithPro((data?.length ?? 0) > 0);
    })();
  }, [user, proProfileId]);

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

  const displayReviews = previewLimit != null ? reviews.slice(0, previewLimit) : reviews;

  return (
    <div className="space-y-2.5 text-[0.6rem] sm:text-[0.62rem]" id={previewLimit == null ? scrollToId : undefined}>
      <h2 className="font-heading text-[0.72rem] font-bold text-gray-800 leading-tight">
        {t.reviews.sectionTitle} ({reviews.length})
      </h2>

      {/* Review form only for preview: hide; for full section: show if user has booking */}
      {previewLimit == null && user && !isProOwner && hasBookingWithPro === true && (
        <ReviewForm proProfileId={proProfileId} onSubmitted={fetchReviews} />
      )}

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="animate-spin text-muted-foreground" size={14} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-3 text-gray-800 leading-snug">
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

                {review.title && (
                  <h4 className="font-semibold text-card-foreground text-[0.65rem] leading-snug">{review.title}</h4>
                )}
                {review.content && (
                  <p className="text-[0.6rem] text-muted-foreground leading-snug">{review.content}</p>
                )}

                {/* Photos */}
                {review.photos.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {review.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.url}
                        alt="Review photo"
                        className="w-14 h-14 rounded-md object-cover border"
                      />
                    ))}
                  </div>
                )}

                {/* Pro response */}
                {review.response && (
                  <div className="ml-3 bg-muted/50 border rounded-md p-2">
                    <p className="text-[0.55rem] font-semibold text-muted-foreground mb-0.5">
                      {t.reviews.responseFromPro}
                    </p>
                    <p className="text-[0.6rem] text-card-foreground leading-snug">{review.response.content}</p>
                  </div>
                )}

                {/* Respond button for pro */}
                {isProOwner && !review.response && (
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
