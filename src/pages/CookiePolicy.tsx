import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COOKIE_POLICY_LAST_UPDATED,
  COOKIE_POLICY_LAST_UPDATED_FR,
  COOKIE_POLICY_VERSION,
  COOKIE_SECTIONS_EN,
  COOKIE_SECTIONS_FR,
} from "@/content/cookieContent";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentState,
} from "@/lib/cookieConsent";
import { useEffect, useState } from "react";

export default function CookiePolicy() {
  const { locale, t } = useLanguage();
  const sections = locale === "fr" ? COOKIE_SECTIONS_FR : COOKIE_SECTIONS_EN;
  const lastUpdated = locale === "fr" ? COOKIE_POLICY_LAST_UPDATED_FR : COOKIE_POLICY_LAST_UPDATED;
  const [consent, setConsent] = useState<CookieConsentState | null>(null);

  useEffect(() => {
    setConsent(getCookieConsent());
  }, []);

  const acceptAll = () => {
    const next = setCookieConsent({
      necessary: true,
      preferences: true,
      analytics: true,
      marketing: true,
    });
    setConsent(next);
  };

  const refuseNonEssential = () => {
    const next = setCookieConsent({
      necessary: true,
      preferences: true,
      analytics: false,
      marketing: false,
    });
    setConsent(next);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <div className="container py-10 md:py-16 px-4 md:px-6 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft size={16} /> {t.terms?.backToHome ?? "Back"}
          </Link>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            {locale === "fr" ? "Politique relative aux témoins" : "Cookie Policy"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {locale === "fr" ? "Dernière mise à jour" : "Last updated"}: {lastUpdated} · v{COOKIE_POLICY_VERSION}
          </p>

          <div className="rounded-xl border bg-card p-6 mb-10 space-y-4">
            <h2 className="font-heading text-lg font-semibold">
              {locale === "fr" ? "Vos préférences" : "Your preferences"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {locale === "fr"
                ? "État actuel : analytique "
                : "Current state: analytics "}
              {consent?.analytics ? (locale === "fr" ? "activée" : "on") : locale === "fr" ? "refusée" : "off"}
              {"; "}
              {locale === "fr" ? "marketing " : "marketing "}
              {consent?.marketing ? (locale === "fr" ? "activé" : "on") : locale === "fr" ? "refusé" : "off"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={acceptAll}>
                {locale === "fr" ? "Tout accepter" : "Accept all"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={refuseNonEssential}>
                {locale === "fr" ? "Refuser le non essentiel" : "Refuse non-essential"}
              </Button>
            </div>
          </div>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-heading text-xl font-semibold text-foreground mb-2">{section.title}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{section.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-10 text-sm">
            <Link to="/privacy" className="underline underline-offset-2">
              {locale === "fr" ? "Politique de confidentialité" : "Privacy Policy"}
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
