import { useCallback, useEffect, useState, useRef, type MutableRefObject } from "react";
import { useApplePaySquareMissingHint } from "@/hooks/useApplePaySquareMissingHint";
import {
  ApplePay,
  CreditCard,
  GooglePay,
  PaymentForm,
} from "react-square-web-payments-sdk";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveSquareWebConfig } from "@/lib/squareWebConfig";

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

export type SquareBookingPaymentSuccessMeta = {
  squarePaymentId?: string | null;
  idempotencyKey: string;
  paymentMethodLabel?: string | null;
};

export interface SquareBookingPaymentProps {
  amountCents: number;
  /** Service subtotal in cents; with Square Connect the Edge function sends app_fee_money = 2.1% of this (platform share). */
  baseAmountCents: number;
  /** Seller location when pro uses OAuth Connect; otherwise platform location from env/edge. */
  squareLocationId?: string | null;
  currency?: string;
  proProfileId: string;
  clientId: string;
  onSuccess: (meta: SquareBookingPaymentSuccessMeta) => void;
  onError: (message: string) => void;
  submitLabel?: string;
  /**
   * `client` (default): card/wallet UI; missing-config copy stays customer-friendly.
   * `ops`: may show setup hints for operators.
   */
  audience?: "client" | "ops";
  /**
   * When true, Square authorizes (holds) the card without capturing.
   * Capture/void later via square-finalize-payment when the pro accepts/declines.
   */
  authorizeOnly?: boolean;
}

export default function SquareBookingPayment({
  amountCents,
  baseAmountCents,
  squareLocationId,
  currency = "cad",
  proProfileId,
  clientId,
  onSuccess,
  onError,
  audience = "client",
  authorizeOnly = false,
}: SquareBookingPaymentProps) {
  const { t } = useLanguage();
  const terms = t.terms;
  const plans = t.plans;
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [locationIdForSdk, setLocationIdForSdk] = useState<string | null>(null);
  const idempotencyKeyRef: MutableRefObject<string> = useRef(
    (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return `booking-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      }
    })()
  );
  const applePayAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    void (async () => {
      const cfg = await resolveSquareWebConfig({ preferredLocationId: squareLocationId });
      if (cancelled) return;
      if (cfg) {
        setApplicationId(cfg.applicationId);
        setLocationIdForSdk(cfg.locationId);
      } else {
        setApplicationId(null);
        setLocationIdForSdk(null);
      }
      setConfigLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [squareLocationId]);

  const squareSdkReady = !!(applicationId && locationIdForSdk);
  const showApplePayBeta = useApplePaySquareMissingHint(applePayAnchorRef, squareSdkReady);
  const applePayBetaText = (terms.applePayBetaTestingNote ?? "").trim();

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
      onError(
        audience === "ops"
          ? "Payment not configured. Set VITE_SUPABASE_URL in .env"
          : (terms.checkoutPaymentUnavailable ?? "Card payment is temporarily unavailable."),
      );
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? ANON_KEY;
    if (!authToken) {
      onError(
        audience === "ops"
          ? "Payment not configured. Set VITE_SUPABASE_ANON_KEY in .env or sign in to continue."
          : (terms.checkoutPaymentUnavailable ?? "Card payment is temporarily unavailable."),
      );
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
          base_amount_cents: baseAmountCents,
          currency: currencyCode,
          pro_profile_id: proProfileId,
          client_id: clientId,
          idempotency_key: idempotencyKeyRef.current,
          autocomplete: !authorizeOnly,
          authorize_only: authorizeOnly,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.details ?? data.error ?? "Payment failed");
        return;
      }
      const squarePaymentId =
        typeof data.payment_id === "string" && data.payment_id.trim() ? data.payment_id.trim() : null;
      const paymentMethodLabel =
        typeof data.payment_method_label === "string" && data.payment_method_label.trim()
          ? data.payment_method_label.trim()
          : null;
      onSuccess({
        squarePaymentId,
        idempotencyKey: idempotencyKeyRef.current,
        paymentMethodLabel,
      });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")) {
        onError(
          audience === "ops"
            ? "Network error. Check VITE_SUPABASE_URL in .env and that the square-create-payment Edge Function is deployed."
            : (terms.checkoutPaymentNetworkError ??
                "Payment could not be completed. Check your connection and try again."),
        );
      } else {
        onError(msg || "Network error");
      }
    } finally {
      setLoading(false);
    }
  };

  if (configLoading) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span>{terms.checkoutPaymentLoading ?? (audience === "ops" ? "Loading payment…" : "Loading card payment…")}</span>
      </div>
    );
  }

  if (!applicationId || !locationIdForSdk) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-3">
        {audience === "ops" ? (
          <p>
            Square is not configured. Set Edge Function secrets{" "}
            <code className="bg-muted px-1 rounded">SQUARE_APPLICATION_ID</code> and{" "}
            <code className="bg-muted px-1 rounded">SQUARE_LOCATION_ID</code> (or Vite{" "}
            <code className="bg-muted px-1 rounded">VITE_SQUARE_*</code>), then deploy{" "}
            <code className="bg-muted px-1 rounded">square-web-config</code>. See{" "}
            <code className="bg-muted px-1 rounded">docs/SQUARE-SETUP.md</code>.
          </p>
        ) : (
          <p>
            {terms.checkoutPaymentUnavailable ??
              "Card payment is temporarily unavailable. Please try again later or contact support."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 relative rounded-lg bg-white dark:bg-muted p-1 text-foreground">
      <div className="rounded-lg border border-border bg-muted dark:bg-background/80 p-3 text-sm space-y-1">
        <div className="flex justify-between text-foreground">
          <span>{terms.checkoutChargedTotal ?? "Total to pay"}</span>
          <span className="font-medium">
            ${amountStr} {currencyCode}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {authorizeOnly
            ? (terms.checkoutAuthorizeHoldLine ??
                "Card hold only — you are charged if the professional accepts.")
            : (terms.checkoutPaymentNetworksLine ??
                "Visa, Mastercard, Amex, Discover · Apple Pay · Google Pay")}
        </p>
      </div>
      {loading && (
        <div className="absolute inset-0 bg-white/90 dark:bg-background/90 flex items-center justify-center z-10 rounded-lg">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      )}
      <PaymentForm
        applicationId={applicationId}
        locationId={locationIdForSdk}
        createPaymentRequest={createPaymentRequest}
        cardTokenizeResponseReceived={async (token) => {
          await handleTokenize(token as { status?: string; token?: string; errors?: unknown });
        }}
      >
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {plans?.checkoutDigitalWallet ?? "Digital wallet"}
          </p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div ref={applePayAnchorRef} className="min-h-[48px] min-w-0">
              <ApplePay id="rswps-apple-pay-container" />
            </div>
            <div className="min-h-[48px] min-w-0">
              <GooglePay id="rswps-google-pay-container" buttonSizeMode="fill" buttonType="long" />
            </div>
          </div>
          {showApplePayBeta && applePayBetaText ? (
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5">
              {applePayBetaText}
            </p>
          ) : null}
          <CreditCard style={CARD_STYLE} />
        </div>
      </PaymentForm>
    </div>
  );
}
