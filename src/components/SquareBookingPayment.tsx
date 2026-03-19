import { useCallback, useState } from "react";
import {
  ApplePay,
  CreditCard,
  Divider,
  GooglePay,
  PaymentForm,
} from "react-square-web-payments-sdk";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined;
const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Square card field styles: high contrast on white so placeholders (e.g. card number) are easy to read */
const CARD_STYLE = {
  input: {
    color: "#111827",
    fontSize: "16px",
  },
  "input::placeholder": {
    color: "#9ca3af",
  },
  "input.is-focus::placeholder": {
    color: "#6b7280",
  },
  ".input-container": {
    borderColor: "#d1d5db",
    borderRadius: "8px",
  },
  ".input-container.is-focus": {
    borderColor: "#111827",
  },
} as const;

export interface SquareBookingPaymentProps {
  amountCents: number;
  currency?: string;
  proProfileId: string;
  clientId: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  submitLabel?: string;
}

export default function SquareBookingPayment({
  amountCents,
  currency = "cad",
  proProfileId,
  clientId,
  onSuccess,
  onError,
}: SquareBookingPaymentProps) {
  const [loading, setLoading] = useState(false);

  const amountStr = (amountCents / 100).toFixed(2);
  const currencyCode = currency.toUpperCase().slice(0, 3);

  const createPaymentRequest = useCallback(
    () => ({
      countryCode: "CA",
      currencyCode,
      total: {
        amount: amountStr,
        label: "Total",
      },
    }),
    [amountStr, currencyCode]
  );

  const handleTokenize = async (token: { status?: string; token?: string; errors?: unknown }) => {
    if (token.status === "Cancel" || token.status === "Abort") return;
    if (token.status && token.status !== "OK") {
      const errMsg =
        token.errors != null ? JSON.stringify(token.errors) : `Payment could not be authorized (${token.status})`;
      onError(errMsg);
      return;
    }
    const sourceId = typeof token?.token === "string" ? token.token : "";
    if (!sourceId) {
      onError("Could not get payment token");
      return;
    }
    const paymentUrl = import.meta.env.VITE_SUPABASE_URL
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/square-create-payment`
      : "";
    if (!paymentUrl) {
      onError("Payment not configured. Set VITE_SUPABASE_URL in .env");
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? ANON_KEY;
    if (!authToken) {
      onError("Payment not configured. Set VITE_SUPABASE_ANON_KEY in .env or sign in to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(paymentUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: ANON_KEY ?? "",
        },
        body: JSON.stringify({
          source_id: sourceId,
          amount_cents: amountCents,
          currency: currencyCode,
          pro_profile_id: proProfileId,
          client_id: clientId,
          idempotency_key: `booking-${proProfileId}-${clientId}-${Date.now()}`.slice(0, 45),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.details ?? data.error ?? "Payment failed");
        return;
      }
      onSuccess();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")) {
        onError(
          "Network error. Check VITE_SUPABASE_URL in .env and that the square-create-payment Edge Function is deployed."
        );
      } else {
        onError(msg || "Network error");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!SQUARE_APP_ID || !SQUARE_LOCATION_ID) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Square is not configured. Add <code className="bg-muted px-1 rounded">VITE_SQUARE_APPLICATION_ID</code> and{" "}
          <code className="bg-muted px-1 rounded">VITE_SQUARE_LOCATION_ID</code> to <code className="bg-muted px-1 rounded">.env</code>{" "}
          (see docs/SQUARE-SETUP.md).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative rounded-lg bg-white p-1 text-gray-900">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
        <div className="flex justify-between text-gray-900">
          <span>Charged total</span>
          <span className="font-medium">
            ${amountStr} {currencyCode}
          </span>
        </div>
        <p className="text-xs text-gray-600">Visa, Mastercard, Amex, Discover · Apple Pay · Google Pay</p>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10 rounded-lg">
          <Loader2 size={24} className="animate-spin text-gray-600" />
        </div>
      )}
      <PaymentForm
        applicationId={SQUARE_APP_ID}
        locationId={SQUARE_LOCATION_ID}
        createPaymentRequest={createPaymentRequest}
        cardTokenizeResponseReceived={async (token) => {
          await handleTokenize(token as { status?: string; token?: string; errors?: unknown });
        }}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Digital wallet</p>
          <div className="flex flex-col sm:flex-row gap-2 min-h-[48px]">
            <div className="flex-1 min-w-0 [&_#rswps-apple-pay]:w-full [&_#rswps-apple-pay]:max-w-full">
              <ApplePay id="rswps-apple-pay" />
            </div>
            <div className="flex-1 min-w-0 min-h-[48px]">
              <GooglePay id="rswps-google-pay-container" buttonSizeMode="fill" buttonType="long" />
            </div>
          </div>
          <Divider>Or card</Divider>
          <CreditCard style={CARD_STYLE} />
        </div>
      </PaymentForm>
    </div>
  );
}
