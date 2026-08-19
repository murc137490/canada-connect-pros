import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCookieConsent, hasCookieDecision, setCookieConsent } from "@/lib/cookieConsent";

export default function CookieConsent() {
  const { t, locale } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasCookieDecision()) setVisible(true);
  }, []);

  const accept = () => {
    setCookieConsent({ necessary: true, preferences: true, analytics: true, marketing: true });
    setVisible(false);
  };

  const refuseNonEssential = () => {
    setCookieConsent({ necessary: true, preferences: true, analytics: false, marketing: false });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border text-card-foreground shadow-lg">
      <div className="container max-w-3xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          {locale === "fr"
            ? "Nous utilisons des témoins nécessaires au site. Les témoins analytiques et marketing restent désactivés tant que vous ne les acceptez pas. "
            : "We use necessary cookies for the site to work. Analytics and marketing cookies stay off until you accept them. "}
          <Link to="/cookies" className="underline underline-offset-2">
            {locale === "fr" ? "En savoir plus" : "Learn more"}
          </Link>
          {" · "}
          <Link to="/privacy" className="underline underline-offset-2">
            {locale === "fr" ? "Confidentialité" : "Privacy"}
          </Link>
          {getCookieConsent() ? null : null}
        </p>
        <div className="flex flex-wrap gap-2 shrink-0 [&_button]:shadow-sm">
          <Button variant="outline" size="sm" onClick={refuseNonEssential} className="border-border bg-background">
            {locale === "fr" ? "Refuser le non essentiel" : (t.cookies?.decline ?? "Refuse non-essential")}
          </Button>
          <Button size="sm" onClick={accept}>
            {t.cookies?.accept ?? "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
