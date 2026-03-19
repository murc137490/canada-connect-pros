import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const STORAGE_KEY = "premiere-cookie-consent";

export default function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== "accepted" && saved !== "declined") setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-lg">
      <div className="container max-w-3xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          {t.cookies.message}
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={decline}>
            {t.cookies.decline}
          </Button>
          <Button size="sm" onClick={accept}>
            {t.cookies.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
