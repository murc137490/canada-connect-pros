import { useState, useMemo } from "react";
import { CreditCard, ArrowLeft, Check } from "lucide-react";
import SquareBookingPayment from "@/components/SquareBookingPayment";
import { Button } from "@/components/ui/button";

const TAX_RATE = 0.15;
const PROCESSING_FEE = 0.05;

export interface BookingCheckoutProps {
  serviceName: string;
  durationLabel?: string | null;
  dateLabel: string;
  /** Service subtotal in cents (before tax & processing fee). */
  baseAmountCents: number;
  currency?: string;
  proProfileId: string;
  clientId: string;
  onPaymentComplete: () => Promise<{ bookingId?: string } | void>;
  onError: (message: string) => void;
  onDone: () => void;
}

export default function BookingCheckout({
  serviceName,
  durationLabel,
  dateLabel,
  baseAmountCents,
  currency = "cad",
  proProfileId,
  clientId,
  onPaymentComplete,
  onError,
  onDone,
}: BookingCheckoutProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [confirmationRef, setConfirmationRef] = useState<string>("");
  const [completing, setCompleting] = useState(false);

  const { subtotal, tax, processingFee, totalCents, totalDollars } = useMemo(() => {
    const sub = Math.max(0, baseAmountCents / 100);
    const taxAmt = sub * TAX_RATE;
    const proc = sub * PROCESSING_FEE;
    const total = sub + taxAmt + proc;
    const cents = Math.max(500, Math.round(total * 100));
    return {
      subtotal: sub,
      tax: taxAmt,
      processingFee: proc,
      totalCents: cents,
      totalDollars: total.toFixed(2),
    };
  }, [baseAmountCents]);

  const handleBack = () => {
    if (step > 1 && step < 3) setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  };

  const handleSquareSuccess = async () => {
    setCompleting(true);
    try {
      const result = await onPaymentComplete();
      const id = result && typeof result === "object" && "bookingId" in result && result.bookingId
        ? String(result.bookingId).slice(0, 8).toUpperCase()
        : Math.random().toString(36).slice(2, 10).toUpperCase();
      setConfirmationRef(id);
      setStep(3);
    } catch (e) {
      onError((e as Error).message ?? "Could not complete booking");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-2xl shadow-xl overflow-hidden bg-white text-gray-900 border border-gray-200">
      {/* Header — Bolt-style */}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Review your booking</h3>
              <p className="text-sm text-gray-500">Confirm details before payment</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
              <div className="border-b border-gray-200 pb-3">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Service details</h4>
                <div className="space-y-1.5 text-sm">
                  <Row label="Service" value={serviceName} />
                  {durationLabel ? <Row label="Duration" value={durationLabel} /> : null}
                  <Row label="Date" value={dateLabel} />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Price breakdown</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service</span>
                    <span className="text-gray-900">${subtotal.toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing fee</span>
                    <span className="text-gray-900">${processingFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax (8%)</span>
                    <span className="text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Payment</h3>
              <p className="text-sm text-gray-500">Card, Apple Pay, or Google Pay via Square</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-gray-900 font-medium mb-3 text-sm">
                <CreditCard className="w-5 h-5" />
                <span>Payment</span>
              </div>
              <div className="rounded-lg overflow-hidden border border-gray-100 bg-white p-3">
                <SquareBookingPayment
                  amountCents={totalCents}
                  currency={currency}
                  proProfileId={proProfileId}
                  clientId={clientId}
                  onSuccess={handleSquareSuccess}
                  onError={onError}
                />
              </div>
            </div>
            {completing && (
              <p className="text-sm text-center text-gray-600">Confirming your booking…</p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6 space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-1">Booking confirmed</h3>
              <p className="text-sm text-gray-600">Your payment went through successfully</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm border border-gray-100">
              <div className="flex justify-between">
                <span className="text-gray-600">Confirmation</span>
                <span className="font-mono font-medium text-gray-900">#{confirmationRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total paid</span>
                <span className="font-semibold text-gray-900">${totalDollars} {currency.toUpperCase()}</span>
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
      <span className="text-gray-600 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function StepDot({ n, done, current, label }: { n: number; done: boolean; current: number; label: string }) {
  const active = current >= n;
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
          active ? "bg-white text-gray-900" : "bg-gray-600 text-white"
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
