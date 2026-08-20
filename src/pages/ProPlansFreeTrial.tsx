import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApplePay, CreditCard, GooglePay, PaymentForm } from "react-square-web-payments-sdk";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { startGrowthTrial, type TrialSource } from "@/lib/trialCheckout";

const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APPLICATION_ID as string | undefined;
const SQUARE_LOCATION_ID = import.meta.env.VITE_SQUARE_LOCATION_ID as string | undefined;

const CARD_STYLE = {
  input: {
    backgroundColor: "#ffffff",
    color: "#171717",
    fontSize: "16px",
  },
  "input::placeholder": { color: "#737373" },
  ".input-container": {
    borderColor: "#d4d4d4",
    borderRadius: "6px",
    borderWidth: "1px",
  },
  ".input-container.is-focus": { borderColor: "#171717" },
} as const;

export default function ProPlansFreeTrial() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");
  const source: TrialSource = token ? "personal" : location.pathname.endsWith("/freetrial") ? "freetrial" : "normal";
  const durationDays = source === "personal" ? 60 : source === "freetrial" ? 14 : 7;
  const redirect = `${location.pathname}${location.search}`;
  const squareReady = !!(SQUARE_APP_ID && SQUARE_LOCATION_ID);

  const gt = t.plans?.growthTrial;

  const headline = useMemo(() => {
    if (source === "personal") return gt?.headlinePersonal ?? "Claim your 2-month Growth trial";
    if (source === "freetrial") return gt?.headlineFreetrial ?? "Start your 14-day Growth trial";
    return gt?.headlineNormal ?? "Start your 7-day Growth trial";
  }, [source, gt?.headlinePersonal, gt?.headlineFreetrial, gt?.headlineNormal]);

  const bullets = useMemo(
    () => [
      gt?.bullet1 ?? "Growth tier access for leads, client tools, and repeat booking features.",
      gt?.bullet2 ?? "No public navigation points to this special trial page.",
      gt?.bullet3 ?? "One trial per account, Square payment profile, and network limits.",
    ],
    [gt?.bullet1, gt?.bullet2, gt?.bullet3]
  );

  const footerText =
    source === "personal"
      ? (gt?.footerPersonal ??
        "The trial activates Growth only after your pro profile exists. Your card will not be charged before the two-month trial ends; the first charge happens only after that period, when billing begins.")
      : (gt?.footerDefault ??
        "The trial activates Growth only after your pro profile exists. Your card will not be charged before the trial ends; the first charge happens only after the trial period, when billing begins.");

  const createPaymentRequest = useCallback(() => {
    const label =
      durationDays === 60
        ? (gt?.squarePaymentLabelTwoMonth ?? "2-month Growth trial")
        : (gt?.squarePaymentLabelDays ?? "{{n}}-day Growth trial").replace("{{n}}", String(durationDays));
    return {
      countryCode: "CA",
      currencyCode: "CAD",
      total: {
        amount: "0.00",
        label,
      },
    };
  }, [durationDays, gt?.squarePaymentLabelTwoMonth, gt?.squarePaymentLabelDays]);

  const formatUiDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });

  const handleTokenize = async (tokenResult: { status?: string; token?: string; errors?: unknown }) => {
    if (tokenResult.status === "Cancel" || tokenResult.status === "Abort") return;
    if (tokenResult.status && tokenResult.status !== "OK") {
      setError(tokenResult.errors != null ? JSON.stringify(tokenResult.errors) : `Payment method failed (${tokenResult.status})`);
      return;
    }
    const sourceId = typeof tokenResult.token === "string" ? tokenResult.token : "";
    if (!sourceId) {
      setError("Could not get payment method token.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: trialError } = await startGrowthTrial({ source, sourceId, token });
      if (trialError) throw trialError;
      if (data?.needs_profile) {
        toast({
          title: gt?.toastReservedTitle ?? "Trial reserved",
          description: data.message ?? gt?.toastReservedBody ?? "Create your pro profile to activate your Growth trial.",
        });
        navigate("/create-pro-account?trial=pending");
        return;
      }
      const trialEnd = data?.trial_ends_at;
      toast({
        title: gt?.toastStartedTitle ?? "Growth trial started",
        description: trialEnd
          ? (gt?.toastStartedBody ?? "Your trial runs until {{date}}.").replace("{{date}}", formatUiDate(trialEnd))
          : undefined,
      });
      navigate("/pro-plans");
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background pt-16">
        <div className="container max-w-5xl px-4 py-12 md:py-20">
          <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-start">
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                {gt?.eyebrow ?? "Growth tier trial"}
              </p>
              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">{headline}</h1>
              <p className="mt-5 max-w-2xl text-muted-foreground">
                {gt?.lead ??
                  "Try Growth tools with no charge today. We verify your email, limit trials per account and network, and securely store one Square payment method before activating access."}
              </p>
              <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
                {bullets.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck className="size-5" /> {gt?.cardTitle ?? "Start Free Trial"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {gt?.signInPrompt ??
                        "Sign up or log in first. After email verification, come back here to start your trial."}
                    </p>
                    <Button asChild className="w-full">
                      <Link to={`/auth?mode=signup&redirect=${encodeURIComponent(redirect)}`}>
                        {gt?.createAccount ?? "Create account"}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/auth?mode=login&redirect=${encodeURIComponent(redirect)}`}>{gt?.logIn ?? "Log in"}</Link>
                    </Button>
                  </div>
                ) : !user.email_confirmed_at ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
                    {gt?.verifyEmail ?? "Please verify your email before starting a free trial, then refresh this page."}
                  </div>
                ) : !squareReady ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-foreground">
                    {gt?.squareMissing ??
                      "Square is not configured. Add the Square application and location environment variables before trials can start."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{gt?.chargeTodayLabel ?? "Charge today"}</span>
                        <span className="font-semibold">{gt?.chargeTodayAmount ?? "$0.00 CAD"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{gt?.trialLengthLabel ?? "Trial length"}</span>
                        <span className="font-semibold">
                          {durationDays === 60
                            ? (gt?.trialLengthTwoMonths ?? "2 months")
                            : (gt?.trialLengthDays ?? "{{n}} days").replace("{{n}}", String(durationDays))}
                        </span>
                      </div>
                    </div>
                    <div className="relative rounded-md border bg-white p-4 [color-scheme:light]">
                      {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
                          <Loader2 className="size-6 animate-spin text-neutral-500" />
                        </div>
                      )}
                      <PaymentForm
                        applicationId={SQUARE_APP_ID!}
                        locationId={SQUARE_LOCATION_ID!}
                        createPaymentRequest={createPaymentRequest}
                        cardTokenizeResponseReceived={async (result) => {
                          await handleTokenize(result as { status?: string; token?: string; errors?: unknown });
                        }}
                      >
                        <div className="space-y-3">
                          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                            {t.plans?.checkoutDigitalWallet ?? "Digital wallet"}
                          </p>
                          <div className="grid min-w-0 grid-cols-2 gap-3">
                            <div className="min-h-[48px] min-w-0 overflow-hidden rounded-lg">
                              <ApplePay id="trial-apple-pay" />
                            </div>
                            <div className="min-h-[48px] min-w-0 overflow-hidden rounded-lg">
                              <GooglePay
                                id="trial-google-pay"
                                buttonSizeMode="fill"
                                buttonType="long"
                                buttonColor="black"
                              />
                            </div>
                          </div>
                          <CreditCard style={CARD_STYLE} />
                        </div>
                      </PaymentForm>
                    </div>
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    <p className="text-xs leading-relaxed text-muted-foreground">{footerText}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
