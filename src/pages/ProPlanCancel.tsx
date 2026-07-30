import { useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { ProPlanId } from "@/lib/proPlanPreview";
import { cn } from "@/lib/utils";
import { submitProPlanCancel, type ProPlanCancelReason } from "@/lib/proPlanCancel";

export default function ProPlanCancel() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const plan = (searchParams.get("plan") ?? "").toLowerCase() as ProPlanId;
  const c = t.plans?.cancel;

  const reasons: { key: ProPlanCancelReason; label: string }[] = [
    { key: "unsatisfactory", label: c?.reasonUnsatisfactory ?? "The results are unsatisfactory" },
    { key: "dont_use", label: c?.reasonDontUse ?? "I don't use it" },
    { key: "complicated", label: c?.reasonComplicated ?? "Too complicated" },
    { key: "expensive", label: c?.reasonExpensive ?? "Too expensive" },
    { key: "dislike", label: c?.reasonDislike ?? "I simply don't like Premiere Services" },
  ];

  const [reason, setReason] = useState<ProPlanCancelReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [returnDiscountGranted, setReturnDiscountGranted] = useState(false);

  const validPlan = plan === "starter" || plan === "growth" || plan === "pro";

  const planLabel = useMemo(() => {
    if (plan === "starter") return c?.planStarter ?? t.plans?.starter ?? "Starter";
    if (plan === "growth") return c?.planGrowth ?? t.plans?.growth ?? "Growth";
    return c?.planPro ?? t.plans?.pro ?? "Pro";
  }, [plan, c?.planGrowth, c?.planPro, c?.planStarter, t.plans?.growth, t.plans?.pro, t.plans?.starter]);

  const features = useMemo(() => {
    if (plan === "starter") return t.plans?.starterFeatures ?? [];
    if (plan === "growth") return t.plans?.growthFeatures ?? [];
    return [...(t.plans?.growthFeatures ?? []), ...(t.plans?.proAddOnFeatures ?? [])];
  }, [plan, t.plans?.growthFeatures, t.plans?.proAddOnFeatures, t.plans?.starterFeatures]);

  if (!user) return <Navigate to="/auth?mode=login&redirect=/pro-plans" replace />;
  if (!validPlan) return <Navigate to="/pro-plans" replace />;

  const handleConfirm = async () => {
    if (!reason) {
      toast({
        title: locale === "fr" ? "Choix requis" : "Selection required",
        description: locale === "fr" ? "Sélectionnez une raison." : "Please select why you are canceling.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await submitProPlanCancel({ reason, confirm: true });
      if (error) throw error;
      setReturnDiscountGranted(data?.cancel_return_discount_granted === true);
      setDone(true);
    } catch (e) {
      toast({ title: locale === "fr" ? "Erreur" : "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <div className="container max-w-lg py-16 px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{c?.successTitle ?? "We're sorry to see you go"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">{c?.successBody ?? ""}</p>
              {returnDiscountGranted ? (
                <p className="text-sm text-foreground leading-relaxed rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                  {c?.successReturnDiscount ?? ""}
                </p>
              ) : null}
              <Button asChild className="w-full sm:w-auto">
                <Link to="/pro-plans">{c?.backToPlans ?? "Back to plans"}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-5xl py-10 px-4 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{c?.eyebrow ?? "Subscription"}</p>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8">{c?.pageTitle ?? "Cancel your plan"}</h1>

        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">{c?.confirmTitle ?? "Are you sure?"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{c?.confirmLead ?? ""}</p>
                <p className="text-lg font-semibold text-primary">{planLabel}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-3">{c?.whyTitle ?? "Why are you canceling?"}</p>
                <ul className="space-y-2">
                  {reasons.map((r) => {
                    const selected = reason === r.key;
                    return (
                      <li key={r.key}>
                        <button
                          type="button"
                          onClick={() => setReason(r.key)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                            selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                            )}
                          >
                            {selected ? <Check className="size-3" /> : null}
                          </span>
                          <span>{r.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button onClick={() => void handleConfirm()} disabled={submitting || !reason}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  {c?.confirmCta ?? "Confirm cancellation"}
                </Button>
                <Button variant="outline" asChild disabled={submitting}>
                  <Link to="/pro-plans">{c?.backToPlans ?? "Back to plans"}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-lg">{c?.benefitsTitle ?? "Your plan includes"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="size-4 shrink-0 text-primary mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-amber-900 dark:text-amber-100/95 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 leading-relaxed">
                {c?.dataWarning ?? ""}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
