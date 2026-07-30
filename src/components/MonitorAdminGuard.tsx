import { Navigate } from "react-router-dom";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";

/** Redirects monitor-only admins away from pro/client service flows. */
export default function MonitorAdminGuard({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, ready } = usePlatformAdmin();
  if (!ready) return <>{children}</>;
  if (!isPlatformAdmin) return <>{children}</>;
  return <Navigate to="/dashboard?tab=admin" replace />;
}
