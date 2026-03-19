import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const PAYMENT_INTENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface StripeBookingPaymentProps {
  amountCents: number;
  currency?: string;
  proProfileId: string;
  clientId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  submitLabel?: string;
}

function PaymentForm({ onSuccess, onError, submitLabel }: { onSuccess: () => void; onError: (message: string) => void; submitLabel?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?payment=success`;
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
          receipt_email: undefined,
        },
      });
      if (error) {
        onError(error.message ?? "Payment failed");
        return;
      }
      onSuccess();
    } catch (err) {
      onError((err as Error).message ?? "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full gap-2" disabled={!stripe || !elements || loading}>
        {loading && <Loader2 size={16} className="animate-spin" />}
        {submitLabel ?? "Pay now"}
      </Button>
    </form>
  );
}

export default function StripeBookingPayment({
  amountCents,
  currency = "cad",
  proProfileId,
  clientId,
  onSuccess,
  onError,
  submitLabel,
}: StripeBookingPaymentProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [stripePromise] = useState(() => (PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null));

  useEffect(() => {
    if (!PUBLISHABLE_KEY || !ANON_KEY) {
      setFetchError("Stripe not configured. Add VITE_STRIPE_PUBLISHABLE_KEY to .env");
      return;
    }
    (async () => {
      try {
        const res = await fetch(PAYMENT_INTENT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ANON_KEY}`,
            apikey: ANON_KEY,
          },
          body: JSON.stringify({
            amount_cents: amountCents,
            currency,
            pro_profile_id: proProfileId,
            client_id: clientId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFetchError(data.details ?? data.error ?? "Could not start payment");
          return;
        }
        if (data.client_secret) setClientSecret(data.client_secret);
        else setFetchError("Invalid response from server");
      } catch (err) {
        setFetchError((err as Error).message ?? "Network error");
      }
    })();
  }, [amountCents, currency, proProfileId, clientId]);

  if (fetchError) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {fetchError}
      </div>
    );
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span>Loading payment form…</span>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: { borderRadius: "8px" },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm onSuccess={onSuccess} onError={onError} submitLabel={submitLabel} />
    </Elements>
  );
}
