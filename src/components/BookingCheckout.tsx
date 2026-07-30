import { useState, useMemo } from "react";
import { CreditCard, ArrowLeft, Check } from "lucide-react";
import SquareBookingPayment from "@/components/SquareBookingPayment";
import { Button } from "@/components/ui/button";
import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";
import { useLanguage } from "@/contexts/LanguageContext";

export type BookingPaymentMeta = {
  squarePaymentId?: string | null;
  idempotencyKey: string;
  paymentMethodLabel?: string | null;
};

export interface BookingCheckoutProps {
  serviceName: string;
  durationLabel?: string | null;
  dateLabel: string;
  /** Service subtotal in cents (before tax & processing fee). */
  baseAmountCents: number;
  /** When the pro uses Square Connect, tokenization uses this seller location (same app ID as OAuth). */
  squareLocationId?: string | null;
  currency?: string;
  proProfileId: string;
  clientId: string;
  onPaymentComplete: (meta: BookingPaymentMeta) => Promise<{ bookingId?: string; bookingPublicCode?: string } | void>;
  onError: (message: string) => void;
  onDone: () => void;
}

export default function BookingCheckout({
  serviceName,
  durationLabel,
  dateLabel,
  baseAmountCents,
  squareLocationId,
  currency = "cad",
  proProfileId,
  clientId,
  onPaymentComplete,
  onError,
  onDone,
}: BookingCheckoutProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmationRef, setConfirmationRef] = useState<string>("");
  const [completing, setCompleting] = useState(false);

  const { subtotal, gst, qst, processingFee, totalCents, totalDollars } = useMemo(
    () => computeBookingInvoiceFromBaseCents(baseAmountCents),
    [baseAmountCents]
  );

  const handleBack = () => {
    if (step > 1 && step < 3) setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  };

  const handleSquareSuccess = async (meta: BookingPaymentMeta) => {
    setCompleting(true);
    try {
      const result = await onPaymentComplete(meta);
      let ref = "";
      if (result && typeof result === "object") {
        const pub =
          "bookingPublicCode" in result && typeof result.bookingPublicCode === "string"
            ? result.bookingPublicCode.trim().toUpperCase()
            : "";
        if (pub) ref = pub;
      }
      setConfirmationRef(ref || "-");
      setStep(3);
    } catch (e) {
      onError((e as Error).message ?? "Could not complete booking");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl shadow-xl overflow-hidden bg-white dark:bg-card text-foreground border border-border">
      {/* Header - Bolt-style */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          {step > 1 && step < 3 && (
            <button
              type="button"
              onClick={handleBack}
              className="hover:bg-white/10 rounded-full p-1 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-lg font-semibold">Checkout</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-sm">
          <StepDot n={1} done={step > 1} current={step} label="Review" />
          <div className={`flex-1 h-0.5 min-w-[12px] ${step >= 2 ? "bg-white" : "bg-gray-600"}`} />
          <StepDot n={2} done={step > 2} current={step} label="Payment" />
          <div className={`flex-1 h-0.5 min-w-[12px] ${step >= 3 ? "bg-white" : "bg-gray-600"}`} />
          <StepDot n={3} done={step >= 3} current={step} label="Complete" />
        </div>
      </div>

      <div className="p-5 max-h-[70vh] overflow-y-auto">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Review your booking</h3>
              <p className="text-sm text-muted-foreground">Confirm details before payment</p>
            </div>
            <div className="bg-muted rounded-xl p-4 space-y-3 border border-border">
              <div className="border-b border-border pb-3">
                <h4 className="font-semibold text-foreground mb-2 text-sm">Service details</h4>
                <div className="space-y-1.5 text-sm">
                  <Row label="Service" value={serviceName} />
                  {durationLabel ? <Row label="Duration" value={durationLabel} /> : null}
                  <Row label="Date" value={dateLabel} />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2 text-sm">Price breakdown</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="text-foreground">${subtotal.toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.dashboard.invoiceGst}</span>
                    <span className="text-foreground">${gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.dashboard.invoiceQst}</span>
                    <span className="text-foreground">${qst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.dashboard.invoiceProcessing}</span>
                    <span className="text-foreground">${processingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                    <span>Total</span>
                    <span>${totalDollars} {currency.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
            <Button type="button" className="w-full bg-gray-900 hover:bg-gray-800 text-white" onClick={() => setStep(2)}>
              Continue to payment
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Payment</h3>
              <p className="text-sm text-muted-foreground">
                {t.terms.checkoutPaymentMethodsViaSquare ?? "Card, Apple Pay, or Google Pay via Square"}
              </p>
            </div>
            <div className="rounded-xl border border-border p-3 bg-white dark:bg-background shadow-sm">
              <div className="flex items-center gap-2 text-foreground font-medium mb-3 text-sm">
                <CreditCard className="w-5 h-5" />
                <span>Payment</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-border bg-white dark:bg-muted p-3">
                <SquareBookingPayment
                  amountCents={totalCents}
                  baseAmountCents={baseAmountCents}
                  squareLocationId={squareLocationId}
                  currency={currency}
                  proProfileId={proProfileId}
                  clientId={clientId}
                  onSuccess={handleSquareSuccess}
                  onError={onError}
                />
              </div>
            </div>
            {completing && (
              <p className="text-sm text-center text-muted-foreground">Confirming your booking…</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6 space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-1">Booking confirmed</h3>
              <p className="text-sm text-muted-foreground">Your payment went through successfully</p>
            </div>
            <div className="bg-muted rounded-xl p-4 text-left space-y-2 text-sm border border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation</span>
                <span className="font-mono font-medium text-foreground">#{confirmationRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total paid</span>
                <span className="font-semibold text-foreground">${totalDollars} {currency.toUpperCase()}</span>
              </div>
            </div>
            <Button type="button" className="w-full bg-gray-900 hover:bg-gray-800 text-white" onClick={onDone}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function StepDot({ n, done, current, label }: { n: number; done: boolean; current: number; label: string }) {
  const active = current >= n;
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
          active ? "bg-white text-foreground" : "bg-gray-600 text-white"
        }`}
      >
        {done ? <Check className="w-3.5 h-3.5" /> : n}
      </div>
      <span className={`text-[10px] sm:text-xs truncate max-w-[4.5rem] ${active ? "text-white" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}
