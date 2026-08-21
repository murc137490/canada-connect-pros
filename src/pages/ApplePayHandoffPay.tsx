import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import SquareBookingPayment, {
  type SquareBookingPaymentSuccessMeta,
} from "@/components/SquareBookingPayment";
import { isAppleSafariBrowser } from "@/components/ApplePayWalletSlot";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchApplePayHandoff,
  markApplePayHandoffPaid,
  type ApplePayHandoffDraft,
  type ApplePayHandoffRow,
} from "@/lib/applePayHandoff";
import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";
import { buildBookingInvoiceSnapshotV2 } from "@/lib/bookingInvoiceSnapshot";

export default function ApplePayHandoffPay() {
  const { handoffId } = useParams<{ handoffId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [row, setRow] = useState<ApplePayHandoffRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [needsSafari, setNeedsSafari] = useState(false);

  const terms = t.terms;

  useEffect(() => {
    setNeedsSafari(typeof navigator !== "undefined" && !isAppleSafariBrowser());
  }, []);

  useEffect(() => {
    if (!handoffId || authLoading) return;
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchApplePayHandoff(handoffId);
        if (cancelled) return;
        if (!data) {
          setLoadError(terms.applePayHandoffNotFound ?? "This Apple Pay link was not found.");
          return;
        }
        if (data.client_id !== user.id) {
          setLoadError(terms.applePayHandoffWrongAccount ?? "Sign in with the same account you used on your computer.");
          return;
        }
        if (data.status === "paid") {
          setDone(true);
          setRow(data);
          return;
        }
        if (new Date(data.expires_at).getTime() < Date.now() || data.status !== "pending") {
          setLoadError(terms.applePayHandoffExpired ?? "This Apple Pay link has expired. Start again on your computer.");
          return;
        }
        setRow(data);
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handoffId, user, authLoading, terms.applePayHandoffNotFound, terms.applePayHandoffWrongAccount, terms.applePayHandoffExpired]);

  const draft = row?.draft as ApplePayHandoffDraft | undefined;

  const invoice = useMemo(() => {
    if (!draft) return null;
    return computeBookingInvoiceFromBaseCents(Math.max(500, Number(draft.baseAmountCents) || 500));
  }, [draft]);

  const finishBooking = useCallback(
    async (meta: SquareBookingPaymentSuccessMeta) => {
      if (!draft || !row || !user) return;
      setBusy(true);
      setPayError(null);
      try {
        const { data: invProf } = await supabase
          .from("profiles")
          .select("address, full_name, phone, postal_code")
          .eq("user_id", user.id)
          .maybeSingle();

        const customerAddress =
          [invProf?.full_name, invProf?.phone || draft.phone, invProf?.postal_code, invProf?.address]
            .filter((x) => typeof x === "string" && x.trim())
            .join("\n") || draft.phone;

        const { data: pro } = await supabase
          .from("pro_profiles")
          .select(
            "id, business_name, legal_business_name, business_address, location, gst_registration_number, qst_registration_number, user_id",
          )
          .eq("id", draft.proProfileId)
          .maybeSingle();

        const supplierAddress =
          (typeof pro?.business_address === "string" && pro.business_address.trim()) ||
          (typeof pro?.location === "string" && pro.location.trim()) ||
          "";
        const supplierLegal =
          (typeof pro?.legal_business_name === "string" && pro.legal_business_name.trim()) ||
          (pro?.business_name ?? "").trim();

        const snapshot = buildBookingInvoiceSnapshotV2({
          proProfileId: draft.proProfileId,
          businessName: pro?.business_name ?? "",
          supplierLegalName: supplierLegal || (pro?.business_name ?? "Professional"),
          supplierAddress: supplierAddress || "—",
          supplierGstNumber: pro?.gst_registration_number ?? null,
          supplierQstNumber: pro?.qst_registration_number ?? null,
          serviceName: draft.serviceName,
          serviceDescriptionDetailed: draft.serviceName,
          durationLabel: draft.durationLabel ?? null,
          appointmentSummary: draft.dateLabel,
          preferredDate: draft.preferredDate ?? null,
          preferredTime: draft.preferredTime ?? null,
          serviceDurationMinutes: draft.serviceDurationMinutes ?? null,
          serviceCategorySlug: draft.serviceCategorySlug ?? null,
          serviceSlug: draft.serviceSlug ?? null,
          customerAddress,
          baseAmountCents: Math.max(500, Number(draft.baseAmountCents) || 500),
          currency: "cad",
          squarePaymentId: meta.squarePaymentId ?? null,
          idempotencyKey: meta.idempotencyKey,
          paymentMethodLabel: meta.paymentMethodLabel?.trim() || "Apple Pay",
          clientRenewsAnnually: false,
          renewalIntervalMonths: null,
          renewalAnchorDate: null,
          clientMemberNumber: null,
          proMemberNumber: null,
        });

        const payload: Record<string, unknown> = {
          pro_profile_id: draft.proProfileId,
          client_id: draft.clientId,
          status: "pending",
          service_duration_minutes: draft.serviceDurationMinutes ?? null,
          client_unread: false,
          pro_unread: true,
          invoice_snapshot: snapshot,
          cancel_policy_acknowledged_at: new Date().toISOString(),
        };
        if (draft.preferredDate) payload.preferred_date = draft.preferredDate;
        if (draft.preferredTime) payload.preferred_time = draft.preferredTime;
        if (draft.serviceCategorySlug) payload.service_category_slug = draft.serviceCategorySlug;
        if (draft.serviceSlug) payload.service_slug = draft.serviceSlug;
        if (draft.serviceLocationChoice) payload.service_location_choice = draft.serviceLocationChoice;

        const { data: booking, error } = await supabase
          .from("bookings")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);

        if (draft.phone?.trim()) {
          await supabase.from("profiles").update({ phone: draft.phone.trim() }).eq("user_id", user.id);
        }

        await markApplePayHandoffPaid(row.id, {
          squarePaymentId: meta.squarePaymentId,
          idempotencyKey: meta.idempotencyKey,
          paymentMethodLabel: meta.paymentMethodLabel,
          bookingId: booking?.id ?? null,
        });
        setDone(true);
      } catch (e) {
        setPayError((e as Error).message || "Could not complete booking");
      } finally {
        setBusy(false);
      }
    },
    [draft, row, user],
  );

  if (authLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(`/pay/apple-handoff/${handoffId ?? ""}`);
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-semibold">
            {terms.applePayHandoffSignInTitle ?? "Sign in to pay with Apple Pay"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {terms.applePayHandoffSignInBody ??
              "Use the same Première account as on your computer, then Apple Pay will be available in Safari."}
          </p>
          <Button asChild>
            <Link to={`/auth?redirect=${redirect}`}>{t.auth?.signIn ?? "Sign in"}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (loadError) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            {t.common?.home ?? "Home"}
          </Button>
        </div>
      </Layout>
    );
  }

  if (done) {
    return (
      <Layout>
        <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
          <h1 className="text-xl font-semibold">
            {terms.bookingRequestSent ?? "Booking request sent"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {terms.applePayHandoffDoneHint ??
              (locale === "fr"
                ? "Vous pouvez revenir à votre ordinateur — le paiement est terminé."
                : "You can return to your computer — payment is complete.")}
          </p>
          <Button asChild>
            <Link to="/dashboard">{t.nav?.dashboard ?? "Dashboard"}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  if (!draft || !invoice) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-lg px-4 py-8 space-y-4">
        {needsSafari ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-50">
            {terms.applePayHandoffOpenInSafari ??
              "Apple Pay only works in Safari on iPhone. Tap Share → Open in Safari, then continue."}
          </div>
        ) : null}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-5 py-4">
            <h1 className="text-lg font-semibold">
              {terms.applePayHandoffPayTitle ?? "Pay with Apple Pay"}
            </h1>
            <p className="text-xs text-white/80 mt-1">
              {terms.bookingPayHoldHint ?? "Card hold now — charged only if the pro accepts."}
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">{draft.serviceName}</p>
              {draft.durationLabel ? <p className="text-xs text-muted-foreground">{draft.durationLabel}</p> : null}
              <p className="text-xs text-muted-foreground">{draft.dateLabel}</p>
              <p className="text-xs pt-1">
                {terms.bookingEstimatedTotal ?? "Estimated total"}:{" "}
                <span className="font-semibold">${(invoice.totalCents / 100).toFixed(2)} CAD</span>
              </p>
            </div>

            {busy ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {locale === "fr" ? "Finalisation…" : "Finishing…"}
              </div>
            ) : (
              <SquareBookingPayment
                amountCents={invoice.totalCents}
                baseAmountCents={Math.max(500, Number(draft.baseAmountCents) || 500)}
                squareLocationId={draft.squareLocationId}
                currency="cad"
                proProfileId={draft.proProfileId}
                clientId={draft.clientId}
                audience="client"
                authorizeOnly
                onSuccess={(meta) => {
                  void finishBooking(meta);
                }}
                onError={(message) => setPayError(message)}
              />
            )}
            {payError ? <p className="text-sm text-destructive">{payError}</p> : null}
          </div>
        </div>
      </div>
    </Layout>
  );
}
