import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import ProPlansContent from "@/components/ProPlansContent";
import type { ProPlanId } from "@/lib/proPlanPreview";
import MovingStarsBackground from "@/components/MovingStarsBackground";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ProPlanCheckoutModal from "@/components/pro-plan/ProPlanCheckoutModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { referralInvite } from "@/lib/referralInvite";
import { normalizePromotionalInput } from "@/lib/promoCodeInput";
import { computeNextBillingMomentIso } from "@/lib/proration";
import { dispatchProPlanPaidEvent } from "@/lib/proPlanPaidEvent";

export default function ProPlansManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const [proChecked, setProChecked] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proProfileId, setProProfileId] = useState<string | null>(null);
  const [proIsVerified, setProIsVerified] = useState(false);
  const [profileTierRaw, setProfileTierRaw] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<ProPlanId | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<ProPlanId | null>(null);
  const [missingProfileOpen, setMissingProfileOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeemingPromo, setRedeemingPromo] = useState(false);
  const [nextBillingIso, setNextBillingIso] = useState<string | null>(null);

  const refreshPlan = useCallback(async () => {
    if (!user) return;
    const { data: prof } = await supabase
      .from("pro_profiles")
      .select("id, subscription_tier, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: sub } = await supabase
      .from("pro_subscriptions")
      .select("plan_id, billing_start, billing_cycle_days, trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setProProfileId(prof?.id ?? null);
    setProIsVerified(prof?.is_verified === true);
    const profileTier = typeof prof?.subscription_tier === "string" ? prof.subscription_tier.trim().toLowerCase() : "";
    setProfileTierRaw(profileTier || null);
    const raw = typeof sub?.plan_id === "string" ? sub.plan_id.trim().toLowerCase() : "";
    const tier: ProPlanId | null =
      raw === "starter" || raw === "growth" || raw === "pro" ? (raw as ProPlanId) : null;
    setCurrentPlanId(tier);
    const next = computeNextBillingMomentIso({
      billingStart: sub?.billing_start ?? null,
      cycleDays: typeof sub?.billing_cycle_days === "number" ? sub.billing_cycle_days : 30,
      trialEndsAt: sub?.trial_ends_at ?? null,
    });
    setNextBillingIso(next);
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate("/auth?mode=login&redirect=/pro-plans", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).limit(1).maybeSingle();
      if (cancelled) return;
      setProChecked(true);
      setIsPro(!!data);
      if (!data) {
        setProProfileId(null);
        setProIsVerified(false);
        setProfileTierRaw(null);
        setCurrentPlanId(null);
        return;
      }
      await refreshPlan();
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate, refreshPlan]);

  useEffect(() => {
    if (!proChecked || !proProfileId) return;
    if (searchParams.get("onboarding") !== "1") return;
    const nextPlan = (searchParams.get("plan") ?? "").toLowerCase() as ProPlanId;
    if (!["starter", "growth", "pro"].includes(nextPlan)) return;
    if (nextPlan === "starter") return;
    setCheckoutPlan(nextPlan);
    setCheckoutOpen(true);
  }, [proChecked, proProfileId, searchParams]);

  const isOnHold =
    !currentPlanId && (!profileTierRaw || profileTierRaw === "hold");
  const isProspectOnPlans =
    !!proProfileId && (!proIsVerified || isOnHold);
  const isActiveSubscriber = isPro && proIsVerified && !!currentPlanId && !isOnHold;

  const onSelectPlan = (plan: ProPlanId) => {
    if (!proProfileId) {
      setCheckoutPlan(plan);
      setMissingProfileOpen(true);
      return;
    }
    setCheckoutPlan(plan);
    setCheckoutOpen(true);
  };

  const planLabels: Record<ProPlanId, string> = {
    starter: t.plans?.starter ?? "Starter",
    growth: t.plans?.growth ?? "Growth",
    pro: t.plans?.pro ?? "Pro",
  };

  const onCheckoutSuccess = () => {
    toast({
      title: t.plans?.planChangedTitle ?? "Plan updated",
      description: t.plans?.planChangedBody ?? "Your subscription tier is now active.",
    });
    void refreshPlan();
    try {
      if (user?.id) localStorage.setItem(`proPlanPaid:${user.id}`, "true");
    } catch {
      // ignore
    }
    dispatchProPlanPaidEvent();
  };

  const renewalNote =
    isActiveSubscriber && nextBillingIso && currentPlanId
      ? (t.plans?.managePlanNextBilling ?? "Next billing: {{date}}").replace(
          "{{date}}",
          new Date(nextBillingIso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })
        )
      : undefined;

  const handleRedeemPromo = async () => {
    const code = normalizePromotionalInput(promoCode.trim()) || promoCode.trim();
    if (!code) return;
    setRedeemingPromo(true);
    try {
      const { data: validated, error: validateErr } = await referralInvite("validate_code", { code });
      if (validateErr || !validated?.valid) {
        throw validateErr ?? new Error(locale === "fr" ? "Code promotionnel invalide." : "Promotional code is invalid.");
      }
      if (validated.code_kind === "personal_trial" && validated.trial_token) {
        navigate(`/pro-plans/trial?token=${encodeURIComponent(validated.trial_token)}`);
        setPromoCode("");
        return;
      }
      const { data, error } = await referralInvite("redeem_code", { code });
      if (error) throw error;
      if (data?.needs_profile) {
        toast({
          title: locale === "fr" ? "Code promo" : "Promo code",
          description:
            locale === "fr"
              ? "Terminez d'abord votre profil pro, puis réessayez."
              : "Finish your pro profile first, then redeem again.",
          variant: "destructive",
        });
        return;
      }
      setPromoCode("");
      toast({
        title: locale === "fr" ? "Code promo appliqué" : "Promo code applied",
        description: data?.trial_ends_at
          ? locale === "fr"
            ? `Accès débloqué jusqu'au ${new Date(data.trial_ends_at).toLocaleDateString()}.`
            : `Access unlocked until ${new Date(data.trial_ends_at).toLocaleDateString()}.`
          : locale === "fr"
            ? "Votre offre promotionnelle est active."
            : "Your promotional offer is active.",
      });
      await refreshPlan();
    } catch (e) {
      toast({
        title: locale === "fr" ? "Code promo" : "Promo code",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRedeemingPromo(false);
    }
  };

  if (!user) return null;
  if (!proChecked) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative min-h-screen">
        <MovingStarsBackground
          starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
          className={cn(
            "absolute inset-0 z-0 rounded-none",
            resolvedTheme === "dark"
              ? "bg-[radial-gradient(ellipse_at_bottom,_#1a1a1a_0%,_#0a0a0a_100%)]"
              : "bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]"
          )}
          pointerEvents={false}
        />
        <div className="relative z-10 min-h-full pb-24">
          <div className="container py-12 md:py-16 px-4 md:px-6">
            <ProPlansContent
              title={
                isActiveSubscriber
                  ? (t.plans?.managePlanTitle ?? "Manage your plan")
                  : (t.plans?.title ?? "Pro Plans")
              }
              subtitle={t.plans?.subtitle ?? "Choose the plan that fits your business. Upgrade or downgrade anytime."}
              showCompleteProfileCta={isProspectOnPlans}
              hasProProfile={!!proProfileId}
              profileCtaHref="/create-pro-account"
              interactive
              currentPlanId={currentPlanId}
              onSelectPlan={onSelectPlan}
            />
            {isActiveSubscriber ? (
              <div className="mt-6 max-w-3xl">
                {renewalNote ? (
                  <p className="text-sm font-medium text-foreground/90 text-left">{renewalNote}</p>
                ) : null}
                {currentPlanId ? (
                  <p className="mt-2 text-left">
                    <Link
                      to={`/pro-plans/cancel?plan=${currentPlanId}`}
                      className="text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {t.plans?.managePlanWantToCancel ?? "I want to cancel"}
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {isProspectOnPlans ? (
            <div className="pointer-events-none fixed bottom-6 right-4 z-20 w-[min(100%,20rem)] sm:right-6">
              <div className="pointer-events-auto rounded-lg border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur-sm">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                  {locale === "fr" ? "Code promotionnel" : "Promotional code"}
                </p>
                <div className="flex gap-1.5">
                  <Input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder={locale === "fr" ? "Code ou lien d'essai" : "Code or trial link"}
                    className="h-9 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 shrink-0 px-3 text-xs"
                    onClick={() => void handleRedeemPromo()}
                    disabled={redeemingPromo || !promoCode.trim()}
                  >
                    {redeemingPromo ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : locale === "fr" ? (
                      "Utiliser"
                    ) : (
                      "Redeem"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ProPlanCheckoutModal
        open={checkoutOpen}
        onOpenChange={(open) => {
          if (!open) setCheckoutPlan(null);
          setCheckoutOpen(open);
        }}
        proProfileId={proProfileId}
        targetPlan={checkoutPlan}
        planLabels={planLabels}
        strings={{
          title: t.plans?.checkoutTitle ?? "Confirm plan change",
          description: t.plans?.checkoutDescription ?? "You're switching to",
          confirmSwitch: t.plans?.confirmSwitch ?? "Confirm change",
          processing: t.plans?.checkoutProcessing ?? "Updating…",
          squareMissing: t.plans?.squareMissingCheckout ?? "Square is not configured.",
        }}
        onSuccess={onCheckoutSuccess}
      />

      <Dialog
        open={missingProfileOpen}
        onOpenChange={(open) => {
          if (!open) setCheckoutPlan(null);
          setMissingProfileOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "fr" ? "Profil pro non créé" : "Pro profile not created"}</DialogTitle>
            <DialogDescription>
              {locale === "fr"
                ? "Voulez-vous terminer la configuration de votre profil pro avant de choisir un forfait?"
                : "Do you want to finish setting up your pro profile before choosing a plan?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCheckoutPlan(null);
                setMissingProfileOpen(false);
              }}
            >
              {locale === "fr" ? "Pas maintenant" : "Not now"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                const planSearch = checkoutPlan ? `?plan=${checkoutPlan}` : "";
                navigate(`/create-pro-account${planSearch}`);
              }}
            >
              {proProfileId
                ? (t.joinPros.editProfile ?? "Edit Pro Profile")
                : locale === "fr"
                  ? "Terminer le profil"
                  : "Finish profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
