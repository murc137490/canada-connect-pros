import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Supabase puts #error=… in the URL when email confirmation fails (bad redirect allow-list,
 * expired token, trigger error, etc.). That can land on / or any route — not only /auth.
 */
export default function AuthHashErrorToast() {
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    if (!hash.includes("error")) return;
    const hp = new URLSearchParams(hash);
    const description = hp.get("error_description");
    const code = hp.get("error_code");
    const detail = [code, description].filter(Boolean).join(": ");
    const decoded = detail ? decodeURIComponent(detail.replace(/\+/g, " ")) : "";
    toast({
      title: t.auth.emailConfirmFailedTitle,
      description: decoded ? `${t.auth.emailConfirmFailedBody} (${decoded})` : t.auth.emailConfirmFailedBody,
      variant: "destructive",
    });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [t.auth.emailConfirmFailedBody, t.auth.emailConfirmFailedTitle, toast]);

  return null;
}
