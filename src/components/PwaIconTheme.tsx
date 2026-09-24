import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { effectiveProTier } from "@/lib/proTierFeatures";
import { PRO_PLAN_PAID_EVENT } from "@/lib/proPlanPaidEvent";
import { applyPwaIconTheme, resolvePwaIconTier, type PwaIconTier } from "@/lib/pwaIconTheme";

/**
 * Sets the installable PWA / home-screen icon to:
 * - black & white for normal clients (and logged-out)
 * - starter / growth / pro colors when the user has that paid tier
 */
export default function PwaIconTheme() {
  const { user } = useAuth();
  const [tier, setTier] = useState<PwaIconTier>("client");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        if (!cancelled) setTier("client");
        return;
      }
      try {
        const { data: prof } = await supabase
          .from("pro_profiles")
          .select("is_verified, subscription_tier")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!prof || prof.is_verified !== true) {
          if (!cancelled) setTier("client");
          return;
        }

        const { data: sub } = await supabase
          .from("pro_subscriptions")
          .select("plan_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const paid = effectiveProTier(prof.subscription_tier, sub?.plan_id);
        if (!cancelled) setTier(resolvePwaIconTier(paid));
      } catch {
        if (!cancelled) setTier("client");
      }
    };

    void load();
    const onPaid = () => void load();
    window.addEventListener(PRO_PLAN_PAID_EVENT, onPaid);
    return () => {
      cancelled = true;
      window.removeEventListener(PRO_PLAN_PAID_EVENT, onPaid);
    };
  }, [user?.id]);

  useEffect(() => {
    applyPwaIconTheme(tier);
  }, [tier]);

  return null;
}
