import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import BookingEvidenceGallery from "@/components/BookingEvidenceGallery";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  VALID_DISPUTE_CATEGORIES,
  INVALID_DISPUTE_EXAMPLES,
  type DisputeCategoryId,
} from "@/lib/disputeCategories";
import { MIN_CLAIM_REPORT_IMAGES } from "@/lib/jobRequestRules";

const EVIDENCE_BUCKET = "booking-evidence";

const CLAIM_SAVE = "__CLAIM_SAVE__";
const CLAIM_BUCKET = "__CLAIM_BUCKET__";
const CLAIM_UPLOAD_PREFIX = "__CLAIM_UPLOAD__:";

type ClaimTypeDb = "issue" | "payment_problem" | "service_problem" | "cancellation";

function getFileExt(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toLowerCase() : "bin";
}

const MAX_CLAIM_IMAGES = 5;

/** Report types map to booking_claim_requests.claim_type (DB check constraint). */
export default function BookingClaimDialog({
  open,
  onOpenChange,
  bookingId,
  proProfileId,
  bookingStatusCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  proProfileId: string;
  /** Raw booking status for display (localized in the dialog). */
  bookingStatusCode?: string | null;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, locale } = useLanguage();
  const d = t.dashboard;
  const [message, setMessage] = useState("");
  const [claimImages, setClaimImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState<DisputeCategoryId>("incomplete_service");
  const selectedDispute = VALID_DISPUTE_CATEGORIES.find((c) => c.id === disputeCategory) ?? VALID_DISPUTE_CATEGORIES[1];
  const claimType = selectedDispute.claimType;

  const dialogTitle = useMemo(
    () => (bookingId ? (d.reportDialogTitle ?? "Report an issue") : (d.reportHelpDialogTitle ?? "Help / Claim")),
    [bookingId, d.reportDialogTitle, d.reportHelpDialogTitle]
  );

  const statusLine = useMemo(() => {
    if (!bookingStatusCode) return null;
    const code = bookingStatusCode;
    const label =
      code === "pending"
        ? d.bookingStatusPending
        : code === "accepted"
          ? d.bookingStatusAccepted
          : code === "completed"
            ? d.bookingStatusCompleted
            : code === "declined"
              ? d.bookingStatusDeclined
              : code === "cancelled"
                ? d.bookingStatusCancelled
                : code;
    return (d.reportBookingStatusLine ?? "Current booking status: {{status}}").replace("{{status}}", String(label ?? ""));
  }, [bookingStatusCode, d]);

  const onPickClaimImages = (picked: FileList | null) => {
    const next = Array.from(picked ?? []).filter((f) => f.type.startsWith("image/"));
    const remaining = Math.max(0, MAX_CLAIM_IMAGES - claimImages.length);
    if (next.length > remaining) {
      toast({
        title: d.claimImageLimitTitle ?? "Limit reached",
        description: (d.claimImageLimitDescription ?? "You can attach up to {{max}} pictures.").replace("{{max}}", String(MAX_CLAIM_IMAGES)),
        variant: "destructive",
      });
    }
    setClaimImages((prev) => [...prev, ...next.slice(0, remaining)]);
  };

  const removeClaimImageAt = (idx: number) => {
    setClaimImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadClaimImages = async (): Promise<string[]> => {
    if (!bookingId || claimImages.length === 0) return [];
    const urls: string[] = [];
    for (const f of claimImages) {
      const ext = getFileExt(f.name);
      const path = `${bookingId}/report-issue/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, f, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        if (error.message?.toLowerCase().includes("bucket")) {
          throw new Error(CLAIM_BUCKET);
        }
        throw new Error(`${CLAIM_UPLOAD_PREFIX}${error.message}`);
      }
      const { data } = supabase.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleSubmitReport = async () => {
    if (!bookingId || !proProfileId) return;
    if (!message.trim()) {
      toast({
        title: d.claimAddDetailsTitle ?? "Add details",
        description: d.claimAddDetailsDescription ?? "Describe what went wrong so support can review your booking.",
        variant: "destructive",
      });
      return;
    }
    if (claimImages.length < MIN_CLAIM_REPORT_IMAGES) {
      toast({
        title: d.claimPhotosRequiredTitle ?? "Photos required",
        description: (d.claimPhotosRequiredDesc ?? "Please attach at least {{count}} pictures.").replace(
          "{{count}}",
          String(MIN_CLAIM_REPORT_IMAGES),
        ),
        variant: "destructive",
      });
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      toast({
        title: d.claimSignInTitle ?? "Please sign in",
        description: d.claimSignInDescription ?? "You need an active session to submit a report.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      let attachment_urls: string[] = [];
      if (claimImages.length > 0) {
        attachment_urls = await uploadClaimImages();
      }

      const payload = {
        booking_id: bookingId,
        client_id: user.id,
        pro_profile_id: proProfileId,
        claim_type: claimType,
        dispute_category: disputeCategory,
        message: message.trim(),
        attachment_urls,
        status: "pending" as const,
      };

      const { data: saved, error: insertError } = await supabase
        .from("booking_claim_requests")
        .insert(payload)
        .select("id, issue_number")
        .single();
      if (insertError || !saved) {
        throw new Error(CLAIM_SAVE);
      }

      const { data: fnData, error: fnError } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
        email_sent_support?: boolean;
        email_sent_client?: boolean;
        issue_number?: string;
      }>("send-booking-claim-email", {
        body: {
          claim_id: saved.id,
          booking_id: bookingId,
          claim_type: claimType,
          message: message.trim(),
          attachment_urls,
        },
      });

      if (fnError) {
        const hasNum = typeof saved.issue_number === "number";
        const desc = hasNum
          ? (d.claimReportReceivedEmailFailWithRef ?? "").replace("{{number}}", String(saved.issue_number))
          : (d.claimReportReceivedEmailFailNoRef ?? "");
        toast({
          title: d.claimReportReceivedTitle ?? "Report received",
          description: desc,
        });
      } else if (fnData && typeof fnData === "object" && "error" in fnData && fnData.error) {
        const num = typeof saved.issue_number === "number" ? String(saved.issue_number) : "";
        const desc = num
          ? (d.claimReportReceivedWithError ?? "")
              .replace("{{error}}", String(fnData.error))
              .replace("{{number}}", num)
          : String(fnData.error);
        toast({
          title: d.claimReportReceivedTitle ?? "Report received",
          description: desc,
        });
      } else {
        const refNum = fnData?.issue_number ?? (typeof saved.issue_number === "number" ? String(saved.issue_number) : "");
        const supportOk = fnData?.email_sent_support === true;
        const clientOk = fnData?.email_sent_client === true;
        toast({
          title: d.claimReportSubmittedTitle ?? "Report submitted",
          description: [
            refNum ? (d.claimIssueRefLine ?? "").replace("{{number}}", refNum) : "",
            supportOk ? (d.claimSupportEmailSent ?? "") : (d.claimSupportEmailNotSent ?? ""),
            clientOk ? (d.claimClientEmailSent ?? "") : (d.claimClientEmailNotSent ?? ""),
          ]
            .filter(Boolean)
            .join(" "),
        });
      }

      onOpenChange(false);
      setMessage("");
      setClaimImages([]);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (raw === CLAIM_SAVE) {
        toast({
          title: d.claimSubmitFailedTitle ?? "Could not submit report",
          description: d.claimSaveFailed ?? "Could not save your report.",
          variant: "destructive",
        });
      } else if (raw === CLAIM_BUCKET) {
        toast({
          title: d.claimSubmitFailedTitle ?? "Could not submit report",
          description: d.claimUploadBucketError,
          variant: "destructive",
        });
      } else if (raw.startsWith(CLAIM_UPLOAD_PREFIX)) {
        const msg = raw.slice(CLAIM_UPLOAD_PREFIX.length);
        toast({
          title: d.claimSubmitFailedTitle ?? "Could not submit report",
          description: (d.claimUploadFailed ?? "Photo upload failed: {{message}}").replace("{{message}}", msg),
          variant: "destructive",
        });
      } else {
        const hint =
          raw === "Failed to fetch" || raw.toLowerCase().includes("fetch") ? (d.claimSubmitFetchHint ?? "") : "";
        toast({
          title: d.claimSubmitFailedTitle ?? "Could not submit report",
          description: `${raw}${hint}`,
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenAISupport = () => {
    if (!bookingId) return;
    const details = message.trim() || (locale === "fr" ? "(aucun détail pour le moment)" : "(no details yet)");
    const prompt = (d.claimAiSupportPrompt ?? "I am reporting an issue with booking #{{bookingId}}. Details: {{details}}.")
      .replace("{{bookingId}}", bookingId)
      .replace("{{details}}", details);
    const params = new URLSearchParams({ bookingId, proProfileId, claimType, prompt });
    navigate(`/support?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setMessage("");
          setClaimImages([]);
          setDisputeCategory("incomplete_service");
        }
      }}
    >
      <DialogContent className="flex max-h-[min(92dvh,720px)] w-[min(100vw-1.5rem,28rem)] flex-col gap-0 overflow-hidden bg-background p-0 text-foreground sm:max-w-lg">
        <DialogHeader className="shrink-0 px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {d.reportDialogDescription ??
              "Choose a category, describe what happened, and add photos if helpful. Support will review your booking."}
            {statusLine ? <span className="block mt-2 text-xs">{statusLine}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6">
          <Alert className="border-muted-foreground/25 bg-muted/30">
            <AlertTitle className="text-sm">{d.disputePolicyTitle ?? "Valid disputes only"}</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>{d.disputePolicyIntro ?? "We review reports in these categories. Refunds are not guaranteed."}</p>
              <p className="font-medium text-foreground">{d.disputePolicyNotCovered ?? "Not covered:"}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {INVALID_DISPUTE_EXAMPLES.map((key) => (
                  <li key={key}>{(d as Record<string, string | undefined>)[key] ?? key}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="text-foreground">{d.disputeCategoryLabel ?? "What happened? (choose one)"}</Label>
            <RadioGroup
              value={disputeCategory}
              onValueChange={(v) => setDisputeCategory(v as DisputeCategoryId)}
              className="grid gap-2"
            >
              {VALID_DISPUTE_CATEGORIES.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <RadioGroupItem value={cat.id} id={`dc-${cat.id}`} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-foreground block">
                      {(d as Record<string, string | undefined>)[cat.labelKey] ?? cat.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(d as Record<string, string | undefined>)[cat.hintKey] ?? ""}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <BookingEvidenceGallery bookingId={bookingId ?? ""} />

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="claim-message">
              {d.claimWhatHappenedLabel ?? "What happened?"}
            </label>
            <Textarea
              id="claim-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                d.claimMessagePlaceholder ??
                "Example: The agreed work was not completed; I'd like someone to review and advise on next steps."
              }
              rows={4}
              className="text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="claim-images">
              {(d.claimAttachPicturesRequiredLabel ?? "Attach pictures (required, at least {{min}}, up to {{max}})")
                .replace("{{min}}", String(MIN_CLAIM_REPORT_IMAGES))
                .replace("{{max}}", String(MAX_CLAIM_IMAGES))}
            </label>
            <Input
              id="claim-images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onPickClaimImages(e.target.files)}
              disabled={submitting || !bookingId}
              className="cursor-pointer text-foreground"
            />
            {claimImages.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {claimImages.map((f, i) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div key={`${f.name}-${i}`} className="relative w-24 h-24 rounded-md border overflow-hidden bg-muted/30">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-background/90 border rounded-full p-1 text-muted-foreground hover:text-foreground text-xs leading-none"
                        onClick={() => removeClaimImageAt(i)}
                        aria-label={d.claimRemovePictureAria ?? "Remove picture"}
                        disabled={submitting}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 flex-wrap border-t border-border/60 px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={handleOpenAISupport}>
            {d.claimAskAiSupport ?? "Ask AI support"}
          </Button>
          <Button
            type="button"
            onClick={handleSubmitReport}
            disabled={submitting || !bookingId || claimImages.length < MIN_CLAIM_REPORT_IMAGES}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : (d.claimSubmitReport ?? "Submit report")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

