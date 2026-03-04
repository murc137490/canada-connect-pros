import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
}

export default function ReviewSection({ proProfileId, proUserId }: ReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);

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
      toast({ title: "Response added" });
      setRespondingTo(null);
      setResponseText("");
      fetchReviews();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingResponse(false);
    }
  };

  const isProOwner = user?.id === proUserId;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-xl font-bold text-foreground">
        Reviews ({reviews.length})
      </h2>

      {/* Review form for logged-in non-pro users */}
      {user && !isProOwner && (
        <ReviewForm proProfileId={proProfileId} onSubmitted={fetchReviews} />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No reviews yet. Be the first to leave a review!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const initials = review.reviewer_name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase() || "?";

            return (
              <div key={review.id} className="bg-card border rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-card-foreground text-sm">
                        {review.reviewer_name}
                      </span>
                      <StarRating rating={review.rating} size={14} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {review.title && (
                  <h4 className="font-semibold text-card-foreground">{review.title}</h4>
                )}
                {review.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.content}</p>
                )}

                {/* Photos */}
                {review.photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {review.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.url}
                        alt="Review photo"
                        className="w-24 h-24 rounded-lg object-cover border"
                      />
                    ))}
                  </div>
                )}

                {/* Pro response */}
                {review.response && (
                  <div className="ml-6 bg-muted/50 border rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">
                      Response from the Pro
                    </p>
                    <p className="text-sm text-card-foreground">{review.response.content}</p>
                  </div>
                )}

                {/* Respond button for pro */}
                {isProOwner && !review.response && (
                  <>
                    {respondingTo === review.id ? (
                      <div className="ml-6 space-y-2">
                        <Textarea
                          placeholder="Write your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          maxLength={500}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleRespond(review.id)}
                            disabled={submittingResponse}
                            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                          >
                            {submittingResponse ? <Loader2 className="animate-spin" size={14} /> : "Post Response"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRespondingTo(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-6 gap-1 text-muted-foreground"
                        onClick={() => setRespondingTo(review.id)}
                      >
                        <MessageSquare size={14} /> Respond
                      </Button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
