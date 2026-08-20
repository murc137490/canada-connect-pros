import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCanadianPhone, phoneDigits } from "@/lib/canadianPhone";
import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";
import SquareBookingPayment, {
  type SquareBookingPaymentSuccessMeta,
} from "@/components/SquareBookingPayment";

type Props = {
  serviceName: string;
  durationLabel?: string | null;
  dateLabel: string;
  baseAmountCents: number;
  profilePhone?: string | null;
  squareLocationId?: string | null;
  proProfileId: string;
  clientId: string;
  /** Create the pending booking after the card hold succeeds. */
  onSubmit: (
    confirmedPhone: string,
    payment: SquareBookingPaymentSuccessMeta,
  ) => Promise<void>;
  onError: (message: string) => void;
  onDone: () => void;
};

export default function BookingRequestConfirm({
  serviceName,
  durationLabel,
  dateLabel,
  baseAmountCents,
  profilePhone,
  squareLocationId,
  proProfileId,
  clientId,
  onSubmit,
  onError,
  onDone,
}: Props) {
  const { t, locale } = useLanguage();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<"details" | "pay">("details");

  useEffect(() => {
    if (profilePhone?.trim()) {
      setPhone(formatCanadianPhone(profilePhone));
    }
  }, [profilePhone]);

  const invoice = useMemo(
    () => computeBookingInvoiceFromBaseCents(Math.max(500, Number(baseAmountCents) || 500)),
    [baseAmountCents],
  );
  const totalDisplay =
    typeof invoice.totalDollars === "string"
      ? invoice.totalDollars
      : Number(invoice.totalCents / 100).toFixed(2);
  const digits = phoneDigits(phone);

  const handleContinueToPay = () => {
    if (digits.length !== 10) {
      onError(t.terms.bookingPhoneRequired ?? "Enter a valid 10-digit phone number.");
      return;
    }
    setStep("pay");
  };

  const handlePaymentSuccess = async (meta: SquareBookingPaymentSuccessMeta) => {
    setSubmitting(true);
    try {
      await onSubmit(phone, meta);
      setDone(true);
    } catch (e) {
      onError((e as Error).message ?? "Could not send booking request");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <p className="text-lg font-semibold text-foreground">{t.terms.bookingRequestSent}</p>
        <p className="text-sm text-muted-foreground">
          {t.terms.bookingRequestSentHoldHint ??
            (locale === "fr"
              ? "Votre carte est pré-autorisée. Le montant n’est débité que si le professionnel accepte."
              : "Your card is authorized. You are only charged if the professional accepts.")}
        </p>
        <Button type="button" onClick={onDone}>
          {t.common.close ?? "Close"}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl border border-border bg-card text-foreground overflow-hidden">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-4">
        <h2 className="text-lg font-semibold">{t.terms.bookingConfirmRequestTitle ?? "Confirm booking request"}</h2>
        <p className="text-xs text-white/80 mt-1">
          {t.terms.bookingPayHoldHint ??
            (locale === "fr"
              ? "Paiement pré-autorisé maintenant — débité seulement si le pro accepte."
              : "Card hold now — charged only if the pro accepts.")}
        </p>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
          <p className="font-medium">{serviceName}</p>
          {durationLabel ? <p className="text-muted-foreground text-xs">{durationLabel}</p> : null}
          <p className="text-muted-foreground text-xs">{dateLabel}</p>
          <p className="text-xs pt-1">
            {t.terms.bookingEstimatedTotal ?? "Estimated total"}:{" "}
            <span className="font-semibold">${totalDisplay} CAD</span>
            <span className="text-muted-foreground">
              {" "}
              ({t.terms.bookingHoldUntilAccept ?? (locale === "fr" ? "pré-autorisation" : "card hold")})
            </span>
          </p>
        </div>

        {step === "details" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="booking-phone-confirm" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {t.terms.bookingConfirmPhoneLabel ?? "Confirm your phone number"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t.terms.bookingConfirmPhoneHint ??
                  "This is how the professional will reach you once they accept."}
              </p>
              <Input
                id="booking-phone-confirm"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(formatCanadianPhone(e.target.value))}
                placeholder="(514) 555-1234"
                className="text-base"
              />
            </div>

            <Button type="button" className="w-full gap-2" onClick={handleContinueToPay}>
              {t.terms.bookingContinueToCard ??
                (locale === "fr" ? "Continuer vers la carte" : "Continue to card")}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            {submitting ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "fr" ? "Envoi de la demande…" : "Sending request…"}
              </div>
            ) : (
              <SquareBookingPayment
                amountCents={invoice.totalCents}
                baseAmountCents={Math.max(500, Number(baseAmountCents) || 500)}
                squareLocationId={squareLocationId}
                currency="cad"
                proProfileId={proProfileId}
                clientId={clientId}
                audience="client"
                authorizeOnly
                onSuccess={(meta) => {
                  void handlePaymentSuccess(meta);
                }}
                onError={onError}
              />
            )}
            <Button type="button" variant="ghost" className="w-full" disabled={submitting} onClick={() => setStep("details")}>
              {t.common.back ?? "Back"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
