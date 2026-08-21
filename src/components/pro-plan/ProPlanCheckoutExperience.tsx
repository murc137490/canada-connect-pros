import { useCallback, useEffect, useRef, useState } from "react";
import { ApplePay, CreditCard, GooglePay, PaymentForm } from "react-square-web-payments-sdk";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApplePayWalletSlot } from "@/components/ApplePayWalletSlot";
import { computePlanChangePreview, type PlanPreviewOk, type PlanPreviewResult, type ProPlanId } from "@/lib/proPlanPreview";
import { PLAN_CHECKOUT_SESSION_ERROR, submitPlanCheckout } from "@/lib/planCheckoutSubmit";
import { cn } from "@/lib/utils";

export type { ProPlanId };

const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined;
const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined;

const SQUARE_DEVELOPER_URL = "https://developer.squareup.com/console/en/apps";

/** Always light fields: Square’s iframe keeps a light bg; dark-theme text (#fafafa) was invisible. */
const CARD_STYLE_CHECKOUT = {
  input: {
    backgroundColor: "#ffffff",
    color: "#171717",
    fontSize: "16px",
    fontWeight: "normal" as const,
  },
  "input.is-focus": {
    backgroundColor: "#ffffff",
    color: "#171717",
    fontSize: "16px",
    fontWeight: "normal" as const,
  },
  "input.is-error": {
    backgroundColor: "#ffffff",
    color: "#171717",
    fontSize: "16px",
  },
  "input::placeholder": { color: "#737373" },
  "input.is-focus::placeholder": { color: "#525252" },
  "input.is-error::placeholder": { color: "#737373" },
  ".input-container": {
    borderColor: "#d4d4d4",
    borderRadius: "6px",
    borderWidth: "1px",
  },
  ".input-container.is-focus": { borderColor: "#171717" },
  ".input-container.is-error": { borderColor: "#dc2626", borderWidth: "1px" },
} as const;

export interface ProPlanCheckoutExperienceProps {
  proProfileId: string | null;
  targetPlan: ProPlanId | null;
  planLabels: Record<ProPlanId, string>;
  strings: {
    title: string;
    description: string;
    confirmSwitch: string;
    processing: string;
    squareMissing: string;
  };
  onSuccess: () => void;
  onCancel: () => void;
  /** Compact layout when shown inside a dialog. */
  embedded?: boolean;
}

export default function ProPlanCheckoutExperience({
  proProfileId,
  targetPlan,
  planLabels,
  strings,
  onSuccess,
  onCancel,
  embedded = false,
}: ProPlanCheckoutExperienceProps) {
  const { t } = useLanguage();
  const plans = t.plans;
  const terms = t.terms;

  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [preview, setPreview] = useState<PlanPreviewOk | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const previewGeneration = useRef(0);
  const walletApplePayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStep(1);
  }, [proProfileId, targetPlan]);

  useEffect(() => {
    if (!proProfileId || !targetPlan) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const gen = ++previewGeneration.current;
    setPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      try {
        const result = await computePlanChangePreview(proProfileId, targetPlan);
        if (gen !== previewGeneration.current) return;
        if (result.ok) {
          setPreview(result);
          if (result.charge_cents > 0) {
            const returnDiscountCheckout =
              result.cancel_return_discount_applied === true && result.charge_before_discount_cents != null;
            setStep(returnDiscountCheckout ? 1 : 2);
          }
        } else {
          setPreviewError((result as Extract<PlanPreviewResult, { ok: false }>).error);
          setPreview(null);
        }
      } catch (e) {
        if (gen !== previewGeneration.current) return;
        setPreviewError((e as Error).message ?? String(e));
        setPreview(null);
      } finally {
        if (gen === previewGeneration.current) setPreviewLoading(false);
      }
    })();
  }, [proProfileId, targetPlan]);

  const chargeCents = preview?.charge_cents ?? null;
  const amountStr = chargeCents != null ? (chargeCents / 100).toFixed(2) : "-";

  const createPaymentRequest = useCallback(
    () => ({
      countryCode: "CA",
      currencyCode: "CAD",
      total: {
        amount: chargeCents != null ? (chargeCents / 100).toFixed(2) : "0.00",
        label: "Premiere Services",
      },
    }),
    [chargeCents]
  );

  const handleFreeSwitch = async () => {
    if (!proProfileId || !targetPlan) return;
    setSubmitLoading(true);
    setPreviewError(null);
    try {
      const { error } = await submitPlanCheckout({
        preview_only: false,
        pro_profile_id: proProfileId,
        new_plan_id: targetPlan,
      });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      const raw = (e as Error).message ?? String(e);
      setPreviewError(raw === PLAN_CHECKOUT_SESSION_ERROR ? plans?.checkoutSessionExpired ?? raw : raw);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleTokenize = async (token: { status?: string; token?: string; errors?: unknown }) => {
    if (!proProfileId || !targetPlan) return;
    if (token.status === "Cancel" || token.status === "Abort") return;
    if (token.status && token.status !== "OK") {
      const errMsg =
        token.errors != null ? JSON.stringify(token.errors) : `Payment could not be authorized (${token.status})`;
      setPreviewError(errMsg);
      return;
    }
    const sourceId = typeof token?.token === "string" ? token.token : "";
    if (!sourceId) {
      setPreviewError("Could not get payment token");
      return;
    }
    setSubmitLoading(true);
    setPreviewError(null);
    try {
      const { error } = await submitPlanCheckout({
        preview_only: false,
        pro_profile_id: proProfileId,
        new_plan_id: targetPlan,
        source_id: sourceId,
      });
      if (error) throw error;
      onSuccess();
    } catch (e) {
      const raw = (e as Error).message ?? String(e);
      setPreviewError(raw === PLAN_CHECKOUT_SESSION_ERROR ? plans?.checkoutSessionExpired ?? raw : raw);
    } finally {
      setSubmitLoading(false);
    }
  };

  const targetLabel = targetPlan ? planLabels[targetPlan] : "";
  const squareReady = !!(SQUARE_APP_ID && SQUARE_LOCATION_ID);
  const previewReady = !previewLoading && !previewError && preview !== null;
  const needsPayment = previewReady && (chargeCents ?? 0) > 0;
  const freePlanChange = previewReady && chargeCents === 0;
  const applePayBetaText = (terms.applePayBetaTestingNote ?? "").trim();

  const previewMode = preview?.mode ?? null;
  const modeExplanation =
    previewMode === "upgrade_prorate"
      ? plans?.checkoutModeUpgradeProrate
      : previewMode === "first_month"
        ? plans?.checkoutModeFirstMonth
        : previewMode === "downgrade"
          ? plans?.checkoutModeDowngrade
          : null;

  const monthlyOldCents = preview?.monthly_old_cents ?? null;
  const monthlyNewCents = preview?.monthly_new_cents ?? null;

  const returnDiscountBeforeCents = preview?.charge_before_discount_cents ?? null;
  const returnDiscountApplied = preview?.cancel_return_discount_applied === true && returnDiscountBeforeCents != null;

  const returnDiscountCallout =
    returnDiscountApplied && returnDiscountBeforeCents != null ? (
      <div
        className="rounded-lg border-2 border-primary/50 bg-primary/10 px-4 py-4 shadow-sm dark:border-primary/45 dark:bg-primary/15"
        role="status"
        aria-live="polite"
      >
        <p className="text-center text-base font-bold uppercase tracking-[0.12em] text-primary md:text-lg">
          {plans?.checkoutReturnDiscountBadge ?? "20% off applied"}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
          <span className="text-lg font-medium tabular-nums tracking-tight text-neutral-400 line-through dark:text-neutral-500">
            ${(returnDiscountBeforeCents / 100).toFixed(2)} CAD
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary" aria-hidden>
            →
          </span>
          <span className="text-3xl font-bold tabular-nums tracking-tight text-primary dark:text-primary">
            ${amountStr} CAD
          </span>
        </div>
        {plans?.checkoutReturnDiscountNote ? (
          <p className="mt-3 text-center text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
            {plans.checkoutReturnDiscountNote}
          </p>
        ) : null}
      </div>
    ) : null;

  const monthlyLine =
    monthlyOldCents !== null && monthlyNewCents !== null && plans?.monthlyRateLine
      ? plans.monthlyRateLine
          .replace("{{old}}", `$${(monthlyOldCents / 100).toFixed(2)}`)
          .replace("{{new}}", `$${(monthlyNewCents / 100).toFixed(2)}`)
      : null;

  const cycleEndStr =
    preview?.cycle_end_iso != null
      ? new Date(preview.cycle_end_iso).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  const prorationPct =
    preview?.proration_ratio != null ? Math.round(preview.proration_ratio * 1000) / 10 : null;

  const prorationDetailLine =
    previewMode === "upgrade_prorate" &&
    prorationPct !== null &&
    preview?.days_remaining_in_cycle != null &&
    cycleEndStr &&
    plans?.checkoutProrationDetail
      ? plans.checkoutProrationDetail
          .replace("{{days}}", String(preview.days_remaining_in_cycle))
          .replace("{{cycleEnd}}", cycleEndStr)
          .replace("{{pct}}", String(prorationPct))
      : null;

  const billingRenewalUnchangedLine =
    previewMode === "upgrade_prorate" && cycleEndStr && plans?.checkoutBillingRenewalUnchanged
      ? plans.checkoutBillingRenewalUnchanged.replace("{{cycleEnd}}", cycleEndStr)
      : null;

  const dialogTitle =
    step === 2
      ? needsPayment
        ? plans?.checkoutPaymentHeading ?? "Payment method"
        : plans?.checkoutConfirmHeading ?? strings.title
      : strings.title;

  const nextLabel = plans?.checkoutNext ?? "Next";
  const backLabel = plans?.checkoutBack ?? "Back";

  const shellBtn =
    "h-10 px-4 text-xs font-medium uppercase tracking-[0.12em] border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-900";

  const shellBtnPrimary =
    "h-10 px-4 text-xs font-medium uppercase tracking-[0.12em] border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200";

  return (
    <div className={cn("mx-auto max-w-lg px-6", embedded ? "py-6 md:py-8" : "py-10 md:py-14")}>
      <header className={cn("border-b border-neutral-200 dark:border-neutral-800", embedded ? "mb-6 pb-6" : "mb-10 pb-8")}>
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-500">{plans?.checkoutSeriousEyebrow ?? "Subscription"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 md:text-3xl">{dialogTitle}</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {step === 1 ? (
            <>
              {strings.description}{" "}
              {targetLabel ? <span className="font-medium text-neutral-950 dark:text-neutral-100">{targetLabel}</span> : null}
            </>
          ) : needsPayment ? (
            returnDiscountApplied && returnDiscountBeforeCents != null ? (
              <div className="space-y-3">
                <p className="inline-flex w-full justify-center">
                  <span className="rounded-full bg-primary px-4 py-1.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-sm">
                    {plans?.checkoutReturnDiscountBadge ?? "20% off applied"}
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {plans?.checkoutEstimatedCharge ?? "Estimated charge today"}
                  </span>
                  {": "}
                  <span className="tabular-nums text-neutral-400 line-through dark:text-neutral-500">
                    ${(returnDiscountBeforeCents / 100).toFixed(2)} CAD
                  </span>{" "}
                  <span className="font-bold tabular-nums text-primary dark:text-primary">${amountStr} CAD</span>
                </p>
              </div>
            ) : (
              <span>
                {plans?.checkoutEstimatedCharge ?? "Estimated charge today"}:{" "}
                <span className="font-semibold tabular-nums text-neutral-950 dark:text-neutral-50">${amountStr} CAD</span>
              </span>
            )
          ) : (
            <span>{plans?.checkoutNoPaymentNote ?? "Confirm your plan change."}</span>
          )}
        </p>
      </header>

      {previewLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-neutral-400" />
        </div>
      ) : previewError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
      ) : (
        <div className="space-y-8">
          {step === 1 ? (
            <>
              {monthlyLine ? <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{monthlyLine}</p> : null}

              <div className="border border-neutral-200 p-6 dark:border-neutral-800">
                {returnDiscountApplied ? (
                  returnDiscountCallout
                ) : (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-500">
                      {plans?.checkoutEstimatedCharge ?? "Estimated charge today"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-neutral-50">
                      ${amountStr} CAD
                    </p>
                  </>
                )}
                {freePlanChange ? (
                  <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400">{plans?.checkoutNoPaymentNote ?? ""}</p>
                ) : null}
              </div>

              {cycleEndStr && preview?.days_remaining_in_cycle != null ? (
                <dl className="grid gap-3 text-xs text-neutral-600 dark:text-neutral-400 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">{plans?.checkoutCycleEnds ?? "Cycle ends"}</dt>
                    <dd className="mt-1 font-medium text-neutral-950 dark:text-neutral-100">{cycleEndStr}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">{plans?.checkoutDaysRemaining ?? "Days left in cycle"}</dt>
                    <dd className="mt-1 font-medium tabular-nums text-neutral-950 dark:text-neutral-100">{preview.days_remaining_in_cycle}</dd>
                  </div>
                </dl>
              ) : null}

              {prorationDetailLine ? <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{prorationDetailLine}</p> : null}
              {billingRenewalUnchangedLine ? (
                <p className="text-xs leading-relaxed font-medium text-neutral-800 dark:text-neutral-200">{billingRenewalUnchangedLine}</p>
              ) : null}

              {modeExplanation ? <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{modeExplanation}</p> : null}

              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
                <button type="button" className={shellBtn} onClick={onCancel}>
                  {plans?.checkoutCancel ?? "Cancel"}
                </button>
                <button type="button" className={shellBtnPrimary} onClick={() => setStep(2)}>
                  {nextLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              {needsPayment && squareReady ? (
                <div
                  className="relative rounded-md border border-neutral-200 bg-white p-4 [color-scheme:light] dark:border-neutral-600"
                  style={{ colorScheme: "light" }}
                >
                  {submitLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
                      <Loader2 className="size-6 animate-spin text-neutral-500" />
                    </div>
                  )}
                  <PaymentForm
                    applicationId={SQUARE_APP_ID!}
                    locationId={SQUARE_LOCATION_ID!}
                    createPaymentRequest={createPaymentRequest}
                    cardTokenizeResponseReceived={async (token) => {
                      await handleTokenize(token as { status?: string; token?: string; errors?: unknown });
                    }}
                  >
                    <div className="space-y-4">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">{plans?.checkoutDigitalWallet ?? "Digital wallet"}</p>
                      <div className="grid min-w-0 grid-cols-2 gap-2.5">
                        <ApplePayWalletSlot
                          className="sq-wallet-btn h-12 min-h-12 min-w-0 overflow-hidden rounded-[4px]"
                          unavailableLabel={
                            terms.applePayUnavailableOnDevice ??
                            "Apple Pay is available in Safari on iPhone and Mac. Use Google Pay or card here."
                          }
                        >
                          <div ref={walletApplePayRef} className="h-12 min-h-12 min-w-0">
                            <ApplePay id="pro-plan-apple-pay" />
                          </div>
                        </ApplePayWalletSlot>
                        <div className="sq-wallet-btn h-12 min-h-12 min-w-0 overflow-hidden rounded-[4px] ring-1 ring-white/25">
                          <GooglePay id="pro-plan-google-pay" buttonSizeMode="fill" buttonType="plain" buttonColor="black" />
                        </div>
                      </div>
                      <p className="text-[11px] leading-relaxed text-neutral-500">
                        {applePayBetaText ||
                          "Apple Pay works in Safari on iPhone/Mac with Wallet. On Windows and Android, use Google Pay or card."}
                      </p>
                      <CreditCard style={CARD_STYLE_CHECKOUT} />
                    </div>
                  </PaymentForm>
                </div>
              ) : null}

              {needsPayment && !squareReady ? (
                <div className="border border-neutral-300 p-5 text-sm dark:border-neutral-600">
                  <p className="font-medium text-neutral-950 dark:text-neutral-50">{plans?.squareSetupTitle ?? "Card payment unavailable"}</p>
                  <p className="mt-2 leading-relaxed text-neutral-600 dark:text-neutral-400">{plans?.squareSetupBody ?? strings.squareMissing}</p>
                  <a
                    href={SQUARE_DEVELOPER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs font-medium uppercase tracking-[0.12em] text-neutral-950 underline underline-offset-4 dark:text-neutral-100"
                  >
                    {plans?.squareDevConsole ?? "Square Developer"}
                  </a>
                </div>
              ) : null}

              {freePlanChange ? <p className="text-sm text-neutral-600 dark:text-neutral-400">{plans?.checkoutModeDowngrade ?? ""}</p> : null}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" className={shellBtn} onClick={() => setStep(1)}>
                  {backLabel}
                </button>
                {freePlanChange ? (
                  <button type="button" className={shellBtnPrimary} onClick={handleFreeSwitch} disabled={submitLoading}>
                    {submitLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {strings.processing}
                      </span>
                    ) : (
                      strings.confirmSwitch
                    )}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
