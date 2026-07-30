import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  contrastDialogContentClass,
  contrastDialogDescriptionClass,
  contrastDialogTitleClass,
} from "@/lib/dialogContrast";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { canSubmitProReview } from "@/lib/reviewGuards";
import { notifyReviewsChanged } from "@/lib/fetchPendingReviewNotices";
import StarRating from "./StarRating";

interface ReviewFormProps {
  proProfileId: string;
  onSubmitted: () => void;
  /** Hide the inner "Leave a Review" heading when a parent dialog already shows it. */
  hideTitle?: boolean;
}

export default function ReviewForm({ proProfileId, onSubmitted, hideTitle = false }: ReviewFormProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligibility, setEligibility] = useState<"loading" | "ok" | "exists" | "locked">("loading");

  useEffect(() => {
    if (!user?.id || !proProfileId) {
      setEligibility("loading");
      return;
    }
    let cancelled = false;
    setEligibility("loading");
    void (async () => {
      const guard = await canSubmitProReview(proProfileId, user.id);
      if (cancelled) return;
      if (!guard.ok) setEligibility(guard.reason);
      else setEligibility("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, proProfileId]);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      toast({ title: t.reviews.maxPhotos, variant: "destructive" });
      return;
    }
    setPhotos((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPhotoPreviewUrls((prev) => [...prev, url]);
    });
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviewUrls[idx]);
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (eligibility !== "ok") {
      toast({
        title: t.reviews.alreadyReviewedTitle,
        description:
          eligibility === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody,
        variant: "destructive",
      });
      onSubmitted();
      return;
    }
    if (rating === 0) {
      toast({ title: t.reviews.pleaseSelectRating, variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const submitReviewConfirmed = async () => {
    if (!user || rating === 0) return;
    setConfirmOpen(false);
    setSubmitting(true);
    try {
      const guard = await canSubmitProReview(proProfileId, user.id);
      if (!guard.ok) {
        setEligibility(guard.reason);
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description:
            guard.reason === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody,
          variant: "destructive",
        });
        onSubmitted();
        return;
      }
      const { data: review, error: reviewError } = await supabase
        .from("reviews")
        .insert({
          pro_profile_id: proProfileId,
          reviewer_id: user.id,
          rating,
          title: title.trim() || null,
          content: content.trim() || null,
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `${user.id}/${review.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("review-photos")
          .upload(path, photo);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("review-photos")
            .getPublicUrl(path);

          await supabase.from("review_photos").insert({
            review_id: review.id,
            url: urlData.publicUrl,
          });
        }
      }

      toast({ title: t.reviews.reviewSubmitted, description: t.reviews.thankYouFeedback });
      setEligibility("exists");
      notifyReviewsChanged();
      onSubmitted();
      setRating(0);
      setTitle("");
      setContent("");
      setPhotos([]);
      setPhotoPreviewUrls([]);
    } catch (err: any) {
      toast({ title: t.reviews.errorSubmitting, description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (eligibility === "loading") {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  if (eligibility !== "ok") {
    return (
      <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-3 py-2">
        {eligibility === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody}
      </p>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-2.5 space-y-2 text-[0.6rem] sm:text-[0.62rem]">
      {!hideTitle ? (
        <h3 className="font-heading font-bold text-card-foreground text-[0.72rem] leading-tight">{t.reviews.leaveReview}</h3>
      ) : null}
      <p className="text-[0.55rem] text-muted-foreground leading-snug">{t.reviews.definitiveNotice}</p>

      <div>
        <label className="text-[0.6rem] text-muted-foreground block mb-0.5">{t.reviews.yourRating}</label>
        <StarRating rating={rating} interactive onRate={setRating} size={17} />
      </div>

      <Input
        placeholder={t.reviews.reviewTitlePlaceholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="h-7 text-[0.6rem] px-2 py-1"
      />

      <Textarea
        placeholder={t.reviews.tellOthers}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={1000}
        rows={2}
        className="text-[0.6rem] min-h-[3rem] py-1.5 px-2"
      />

      {photoPreviewUrls.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {photoPreviewUrls.map((url, i) => (
            <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden border">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-1 text-[0.6rem] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
          <Camera size={12} />
          <span>{t.reviews.addPhotos}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoAdd}
          />
        </label>

        <Button type="submit" disabled={submitting} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-7 text-[0.6rem] px-2.5 shrink-0">
          {submitting ? <Loader2 className="animate-spin" size={12} /> : t.reviews.submitReview}
        </Button>
      </div>
    </form>
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent className={contrastDialogContentClass}>
        <AlertDialogHeader>
          <AlertDialogTitle className={contrastDialogTitleClass}>{t.reviews.confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription className={contrastDialogDescriptionClass}>{t.reviews.confirmBody}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void submitReviewConfirmed()}>{t.reviews.confirmSubmit}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
