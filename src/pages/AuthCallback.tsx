import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { clearOAuthRedirect, peekOAuthRedirect } from "@/lib/oauthRedirect";
import { canUsePlatformAdminTools, isPlatformAdminEmail, isSuperAdminEmail } from "@/lib/platformAdmin";

/**
 * Handles Supabase Google (and other) OAuth return: PKCE ?code= exchange,
 * query/hash errors, then navigates to the intended app path.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [message, setMessage] = useState(t.auth.continueWithGoogle);

  useEffect(() => {
    let cancelled = false;

    const fail = (detail?: string) => {
      const desc = detail?.trim() || t.auth.toastError;
      toast({ title: t.auth.toastError, description: desc, variant: "destructive" });
      clearOAuthRedirect();
      navigate("/auth?mode=login", { replace: true });
    };

    const run = async () => {
      const qError = searchParams.get("error");
      const qDesc = searchParams.get("error_description");
      if (qError) {
        fail(decodeURIComponent((qDesc || qError).replace(/\+/g, " ")));
        return;
      }

      const hash = window.location.hash?.replace(/^#/, "") ?? "";
      if (hash.includes("error")) {
        const hp = new URLSearchParams(hash);
        fail(decodeURIComponent((hp.get("error_description") || hp.get("error") || "").replace(/\+/g, " ")));
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        setMessage(t.auth.welcomeBack);
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          // Another tab/init may have finished first — accept an existing session.
          const { data: existing } = await supabase.auth.getSession();
          if (!existing.session) {
            fail(error.message);
            return;
          }
        } else if (!data.session) {
          fail(t.auth.toastError);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await new Promise((r) => setTimeout(r, 400));
          const again = await supabase.auth.getSession();
          if (!again.data.session) {
            fail(t.auth.toastError);
            return;
          }
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      let next = peekOAuthRedirect(searchParams.get("redirect") || "/");
      if (user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_platform_admin")
          .eq("user_id", user.id)
          .maybeSingle();
        if (
          isPlatformAdminEmail(user.email) ||
          isSuperAdminEmail(user.email) ||
          canUsePlatformAdminTools(user.email, prof?.is_platform_admin === true)
        ) {
          next = "/dashboard?tab=admin";
        }
      }
      clearOAuthRedirect();
      if (!cancelled) navigate(next, { replace: true });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams, t.auth.continueWithGoogle, t.auth.toastError, t.auth.welcomeBack, toast]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
