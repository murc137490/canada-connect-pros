import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import BootLoadingScreen from "@/components/BootLoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { canUsePlatformAdminTools } from "@/lib/platformAdmin";

/**
 * Admin-only routes. Waits for the session, then:
 *  - signed out → /auth?mode=login&redirect=<current path>
 *  - signed in, not a platform admin → /dashboard
 */
export default function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(null);
      return;
    }
    if (canUsePlatformAdminTools(user.email, false)) {
      setIsAdmin(true);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setIsAdmin(canUsePlatformAdminTools(user.email, data?.is_platform_admin === true));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <BootLoadingScreen />;
  if (!user) {
    const target = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?mode=login&redirect=${encodeURIComponent(target)}`} replace />;
  }
  if (isAdmin === null) return <BootLoadingScreen />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
