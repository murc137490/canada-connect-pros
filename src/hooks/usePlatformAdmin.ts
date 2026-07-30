import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { canUsePlatformAdminTools, isPlatformAdminEmail } from "@/lib/platformAdmin";
import { supabase } from "@/integrations/supabase/client";

/** Monitor admin: email on fixed allowlist (admin1–5@premiereservices.ca); profile flag synced via ensure-platform-admin. */
export function usePlatformAdmin() {
  const { user } = useAuth();
  const [syncedFlag, setSyncedFlag] = useState(false);
  const [ready, setReady] = useState(false);

  const loadAdminFlag = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("is_platform_admin").eq("user_id", userId).maybeSingle();
    return data?.is_platform_admin === true;
  };

  useEffect(() => {
    if (!user?.id) {
      setSyncedFlag(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      let isAdminProfile = await loadAdminFlag(user.id);
      if (!isAdminProfile && isPlatformAdminEmail(user.email)) {
        await supabase.functions.invoke("ensure-platform-admin", { method: "POST" }).catch(() => {});
        isAdminProfile = await loadAdminFlag(user.id);
      }
      if (!cancelled) {
        setSyncedFlag(isAdminProfile);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const isPlatformAdmin = canUsePlatformAdminTools(user?.email ?? null, syncedFlag);

  return {
    isPlatformAdmin,
    /** True when email matches VITE list before profile fetch (avoids admin nav flash). */
    isEnvListedAdmin: isPlatformAdminEmail(user?.email ?? null),
    ready,
  };
}
