import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import ProPlansContent from "@/components/ProPlansContent";
import MovingStarsBackground from "@/components/MovingStarsBackground";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ProPlansManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { resolvedTheme } = useTheme();
  const [proChecked, setProChecked] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth?mode=login&redirect=/pro-plans", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("pro_profiles")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setProChecked(true);
      setIsPro(!!data);
      if (!data) {
        navigate("/dashboard", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  if (!user) return null;
  if (!proChecked || !isPro) {
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
      <div className="relative min-h-screen pt-16">
        <MovingStarsBackground
          starColor={resolvedTheme === "dark" ? "#FFF" : "#000"}
          className={cn(
            "absolute inset-0 z-0 rounded-none",
            resolvedTheme === "dark"
              ? "bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]"
              : "bg-[radial-gradient(ellipse_at_bottom,_#f5f5f5_0%,_#fff_100%)]"
          )}
          pointerEvents={false}
        />
        <div className="relative z-10 min-h-full pb-24">
          <div className="container py-12 md:py-16 px-4 md:px-6">
            <ProPlansContent
              title={t.plans?.managePlanTitle ?? "Manage your plan"}
              subtitle={t.plans?.managePlanSubtitle ?? "Upgrade or downgrade anytime."}
              showCompleteProfileCta={false}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
