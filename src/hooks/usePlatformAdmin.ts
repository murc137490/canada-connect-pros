import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { canUsePlatformAdminTools, isPlatformAdminEmail, isSuperAdminEmail } from "@/lib/platformAdmin";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_STATUS_CACHE_MS = 15_000;
const adminStatusRequests = new Map<string, { promise: Promise<boolean>; expiresAt: number }>();

function emailsForUser(user: User | null | undefined): string[] {
  if (!user) return [];
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v.includes("@")) out.add(v.toLowerCase().trim());
  };
  add(user.email);
  add(user.user_metadata?.email);
  for (const id of user.identities ?? []) {
    add((id as { identity_data?: { email?: string } }).identity_data?.email);
  }
  return [...out];
}

function userIsListedAdmin(user: User | null | undefined): boolean {
  return emailsForUser(user).some((em) => isPlatformAdminEmail(em) || isSuperAdminEmail(em));
}

function userIsSuperAdmin(user: User | null | undefined): boolean {
  return emailsForUser(user).some((em) => isSuperAdminEmail(em));
}

/** Platform admin: seed allowlist, super admin, or DB-granted staff. */
export function usePlatformAdmin() {
  const { user } = useAuth();
  const [syncedFlag, setSyncedFlag] = useState(false);
  const [ready, setReady] = useState(false);

  const listed = userIsListedAdmin(user);

  const syncAdminStatus = (userId: string) => {
    const cached = adminStatusRequests.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.promise;

    const promise = (async () => {
      // Several mounted consumers (Layout, Dashboard, menus) share one sync
      // request. Parallel auth/function calls can otherwise contend on the
      // Supabase session lock during dashboard startup.
      await supabase.functions.invoke("ensure-platform-admin", { method: "POST" }).catch(() => undefined);
      const { data, error } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("user_id", userId)
        .maybeSingle();
      return !error && data?.is_platform_admin === true;
    })().catch(() => false);

    adminStatusRequests.set(userId, { promise, expiresAt: Date.now() + ADMIN_STATUS_CACHE_MS });
    return promise;
  };

  useEffect(() => {
    if (!user?.id) {
      setSyncedFlag(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      // Server allowlist / secrets decide; never rely on emails shipped in the JS bundle.
      const isAdminProfile = await syncAdminStatus(user.id);
      if (!cancelled) {
        setSyncedFlag(isAdminProfile || listed);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, listed]);

  const primaryEmail = emailsForUser(user)[0] ?? user?.email ?? null;
  const isPlatformAdmin =
    canUsePlatformAdminTools(primaryEmail, syncedFlag) || listed || syncedFlag;

  return {
    isPlatformAdmin,
    isEnvListedAdmin: listed,
    isSuperAdmin: userIsSuperAdmin(user),
    ready: listed ? true : ready,
  };
}
