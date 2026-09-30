import { useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    const previous = document.title;
    document.title = fr ? "Abonnement confirmé | AltShift" : "Subscription confirmed | AltShift";
    return () => {
      document.title = previous;
    };
  }, [fr]);

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
