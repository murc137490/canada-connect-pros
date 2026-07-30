import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HelpCircle, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "premiere-help-fab-hidden";

export default function HelpFab() {
  const { t } = useLanguage();
  const location = useLocation();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (hidden || location.pathname.startsWith("/support")) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className={cn(
        "fixed z-[60] flex items-center gap-1",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))]",
      )}
    >
      <Button
        type="button"
        asChild
        size="lg"
        className="h-12 gap-2 rounded-full px-4 shadow-md border border-border/60 bg-card text-foreground hover:bg-muted"
      >
        <Link to="/support" aria-label={t.common.helpFabLabel ?? "Help"}>
          <HelpCircle className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="font-semibold text-sm">{t.common.helpFabLabel ?? "Help"}</span>
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full bg-card/90 border border-border/50 text-muted-foreground hover:text-foreground shadow-sm"
        onClick={dismiss}
        aria-label={t.common.helpFabDismissAria ?? "Hide help button"}
        title={t.common.helpFabDismissAria ?? "Hide help button"}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
