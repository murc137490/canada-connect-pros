import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { effectiveProTier } from "@/lib/proTierFeatures";
import { PRO_PLAN_PAID_EVENT } from "@/lib/proPlanPaidEvent";

const cacheKey = (userId: string) => `activeVerifiedPro:${userId}`;

function readCachedActiveVerifiedPro(userId: string | undefined): boolean | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // ignore
  }
  return null;
}

function writeCachedActiveVerifiedPro(userId: string, active: boolean) {
  try {
    localStorage.setItem(cacheKey(userId), active ? "true" : "false");
  } catch {
    // ignore
  }
}

/** True when the user has an approved pro profile and a billable tier (starter/growth/pro), not hold. */
export function useActiveVerifiedPro(userId: string | undefined) {
  const [active, setActive] = useState<boolean | null>(() => readCachedActiveVerifiedPro(userId));
  const [ready, setReady] = useState(() => !userId || readCachedActiveVerifiedPro(userId) !== null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setActive(null);
      setReady(true);
      return;
    }
    const { data: prof } = await supabase
      .from("pro_profiles")
      .select("is_verified, subscription_tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (prof?.is_verified !== true) {
      setActive(false);
      writeCachedActiveVerifiedPro(userId, false);
      setReady(true);
      return;
    }

    const { data: sub } = await supabase
      .from("pro_subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .maybeSingle();

    const tier = effectiveProTier(prof.subscription_tier, sub?.plan_id);
    const isActive = tier !== null;
    setActive(isActive);
    writeCachedActiveVerifiedPro(userId, isActive);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setActive(null);
      setReady(true);
      return;
    }
    const cached = readCachedActiveVerifiedPro(userId);
    setActive(cached);
    setReady(cached !== null);
    void refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return undefined;
    const onPlanPaid = () => void refresh();
    window.addEventListener(PRO_PLAN_PAID_EVENT, onPlanPaid);
    return () => window.removeEventListener(PRO_PLAN_PAID_EVENT, onPlanPaid);
  }, [userId, refresh]);

  return { activeVerifiedPro: active, ready, refresh };
}

/** Nav/marketing: show Join the Pros only when we know the user is not an active verified pro. */
export function shouldShowJoinPros(userId: string | undefined, activeVerifiedPro: boolean | null, ready: boolean): boolean {
  if (!userId) return true;
  if (activeVerifiedPro === true) return false;
  if (activeVerifiedPro === false) return true;
  // Still loading with no cache: hide to avoid flash for active pros
  if (!ready) return false;
  return true;
}
