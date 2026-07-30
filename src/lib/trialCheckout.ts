import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type TrialSource = "normal" | "freetrial" | "personal";

export type TrialCheckoutResponse = {
  ok?: boolean;
  activated?: boolean;
  needs_profile?: boolean;
  trial_ends_at?: string;
  duration_days?: number;
  plan_id?: string;
  message?: string;
  error?: string;
  details?: string;
};

export type TrialTokenAdminRow = {
  id: string;
  duration_days: number;
  created_at?: string;
  used_at?: string | null;
  status?: "unclaimed" | "claimed";
  /** Present only while the link is unused (copy for sharing). */
  url?: string;
  claimed_by_email?: string | null;
  claimed_by_public_user_number?: string | null;
};

export type TrialTokenAdminResponse = {
  ok?: boolean;
  generated?: { id: string; token: string; url?: string; created_at?: string }[];
  active?: TrialTokenAdminRow[];
  max_active_links?: number;
  error?: string;
};

function functionsBaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  return raw.replace(/\/+$/, "");
}

async function accessToken(): Promise<string | null> {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();
  if (initial?.access_token) return initial.access_token;
  if (!initial?.refresh_token) return null;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return refreshed.session?.access_token ?? null;
}

async function invokeTrialFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> {
  const token = await accessToken();
  if (!token) return { data: null, error: new Error("Please sign in again and retry.") };
  const base = functionsBaseUrl();
  if (!base) return { data: null, error: new Error("VITE_SUPABASE_URL missing") };
  if (!ANON_KEY) return { data: null, error: new Error("VITE_SUPABASE_ANON_KEY missing") };

  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text().catch(() => "");
  let parsed = {} as T & { error?: string; details?: string };
  if (raw) {
    try {
      parsed = JSON.parse(raw) as T & { error?: string; details?: string };
    } catch {
      parsed = {} as T & { error?: string; details?: string };
    }
  }
  if (!res.ok) {
    const message = parsed.details ?? parsed.error ?? (raw.trim() || `HTTP ${res.status}`);
    return { data: null, error: new Error(message) };
  }
  return { data: parsed as T, error: null };
}

export function startGrowthTrial(params: { source: TrialSource; sourceId: string; token?: string | null }) {
  return invokeTrialFunction<TrialCheckoutResponse>("trial-checkout", {
    source: params.source,
    source_id: params.sourceId,
    token: params.token ?? undefined,
  });
}

export function activatePendingGrowthTrial() {
  return invokeTrialFunction<TrialCheckoutResponse>("trial-checkout", {
    action: "activate_pending",
  });
}

export function listTrialTokens() {
  return invokeTrialFunction<TrialTokenAdminResponse>("trial-token-admin", {
    action: "list",
    origin: window.location.origin,
  });
}

export function generateTrialTokens() {
  return invokeTrialFunction<TrialTokenAdminResponse>("trial-token-admin", {
    action: "generate",
    origin: window.location.origin,
  });
}
