import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import BookingEvidenceGallery from "@/components/BookingEvidenceGallery";
import { useToast } from "@/hooks/use-toast";

type ClaimType = "refund" | "redo" | "partial";

export default function BookingClaimDialog({
  open,
  onOpenChange,
  bookingId,
  proProfileId,
  accessToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  proProfileId: string;
  accessToken: string | null | undefined;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [claimType, setClaimType] = useState<ClaimType>("refund");
  const [message, setMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const claimTitle = useMemo(() => {
    if (!bookingId) return "Help / Claim";
    if (claimType === "refund") return `Request a refund (#${bookingId})`;
    if (claimType === "partial") return `Partial refund request (#${bookingId})`;
    return `Request job redone (#${bookingId})`;
  }, [bookingId, claimType]);

  const canSendEmail = claimType === "refund" || claimType === "partial";

  const handleSendEmail = async () => {
    if (!bookingId) return;
    if (!accessToken) {
      toast({ title: "Please sign in", description: "You need an active session to submit a claim.", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Add a short message", description: "Tell support what happened and what you want as a resolution.", variant: "destructive" });
      return;
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) {
      toast({ title: "Not configured", description: "VITE_SUPABASE_URL is missing.", variant: "destructive" });
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch(`${url}/functions/v1/send-booking-claim-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ booking_id: bookingId, pro_profile_id: proProfileId, claim_type: claimType, message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? data.details ?? res.statusText);

      toast({ title: "Claim sent to support", description: "Premiere Services will review your request shortly." });
      onOpenChange(false);
      setMessage("");
      setClaimType("refund");
    } catch (e) {
      toast({ title: "Failed to send claim", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleOpenAISupport = () => {
    if (!bookingId) return;
    const prompt =
      claimType === "redo"
        ? `I need my job redone for booking #${bookingId}. Here are the details: ${message.trim() || "(no details yet)"}.`
        : `I am filing a dispute for booking #${bookingId} (${claimType}). Details: ${message.trim() || "(no details yet)"}.`;
    // Support page will prefill the chat input using `prompt`.
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
          setClaimType("refund");
        }
      }}
    >
      <DialogContent className="bg-background text-gray-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>{claimTitle}</DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Upload evidence from the completed job (shown below) and submit your resolution request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BookingEvidenceGallery bookingId={bookingId ?? ""} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Choose what you need</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={claimType === "refund" ? "default" : "outline"} onClick={() => setClaimType("refund")}>
                Refund
              </Button>
              <Button type="button" variant={claimType === "redo" ? "default" : "outline"} onClick={() => setClaimType("redo")}>
                Job done again
              </Button>
              <Button type="button" variant={claimType === "partial" ? "default" : "outline"} onClick={() => setClaimType("partial")}>
                Partial refund
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white" htmlFor="claim-message">
              Details (what was missing / what you want)
            </label>
            <Textarea
              id="claim-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Example: The work was not finished to the agreed spec. I want a partial refund of $X or the missing work completed."
              rows={4}
              className="text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
          </div>

          <div className="flex justify-end gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={handleOpenAISupport}>
              Ask AI support
            </Button>
            {canSendEmail && (
              <Button type="button" onClick={handleSendEmail} disabled={sendingEmail || !bookingId}>
                {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : "Send claim email"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

