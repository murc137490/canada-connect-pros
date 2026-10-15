import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Public page shown after a Pro subscription is activated.
 * Google Business asks for this URL: the page where a subscription is confirmed.
 */
export default function SubscriptionConfirmed() {
  const { locale } = useLanguage();
  const fr = locale === "fr";
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const plan = (searchParams.get("plan") ?? "").toLowerCase();
  // null = checking; true only when ?plan= matches the signed-in user's current subscription (or an active trial).
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user || !["starter", "growth", "pro", "trial"].includes(plan)) {
      setValid(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("pro_subscriptions")
        .select("plan_id, trial_ends_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = data as { plan_id?: string | null; trial_ends_at?: string | null } | null;
      const trialActive = !!row?.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now();
      setValid(plan === "trial" ? trialActive : (row?.plan_id ?? "").toLowerCase() === plan);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, plan]);

  useEffect(() => {
    const previous = document.title;
    document.title = valid
      ? fr ? "Abonnement confirmé | AltShift" : "Subscription confirmed | AltShift"
      : fr ? "Abonnements AltShift Pro | AltShift" : "AltShift Pro subscriptions | AltShift";
    return () => {
      document.title = previous;
    };
  }, [fr, valid]);

  if (valid === null) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      </Layout>
    );
  }

  if (!valid) {
    // No valid checkout context: neutral copy (this public URL is also listed for Google Business).
    return (
      <Layout>
        <div className="min-h-[70vh]">
          <div className="container max-w-2xl px-4 md:px-6 pt-10 md:pt-16 pb-20">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">AltShift Pro</p>
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight">
              {fr ? "Abonnements AltShift Pro" : "AltShift Pro subscriptions"}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              {fr
                ? "Après le paiement d’un forfait Starter, Growth ou Pro, la confirmation de votre abonnement s’affiche ici."
                : "After you pay for a Starter, Growth, or Pro plan, your subscription confirmation appears here."}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <Link to="/pro-plans">{fr ? "Voir les forfaits" : "See plans"}</Link>
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[70vh]">
        <div className="container max-w-2xl px-4 md:px-6 pt-10 md:pt-16 pb-20">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
            AltShift Pro
          </p>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-8 w-8 shrink-0 text-emerald-600" aria-hidden />
            <h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tight">
              {fr ? "Abonnement confirmé" : "Subscription confirmed"}
            </h1>
          </div>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            {fr
              ? "Votre abonnement AltShift est confirmé. Votre forfait Starter, Growth ou Pro est maintenant actif."
              : "Your AltShift subscription is confirmed. Your Starter, Growth, or Pro plan is now active."}
          </p>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            {fr
              ? "Vous pouvez gérer la facturation et votre profil public depuis votre tableau de bord."
              : "You can manage billing and your public profile from your dashboard."}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg">
              <Link to="/dashboard">{fr ? "Aller au tableau de bord" : "Go to dashboard"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pro-plans">{fr ? "Gérer le forfait" : "Manage plan"}</Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
