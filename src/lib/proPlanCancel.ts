import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export type ProPlanCancelReason =
  | "unsatisfactory"
  | "dont_use"
  | "complicated"
  | "expensive"
  | "dislike";

export type ProPlanCancelResponse = {
  ok?: boolean;
  /** True when a one-time 20% return discount was linked to this account (first qualifying cancel only). */
  cancel_return_discount_granted?: boolean;
  error?: string;
};

export async function submitProPlanCancel(params: {
  reason: ProPlanCancelReason;
  confirm: boolean;
}): Promise<{ data: ProPlanCancelResponse | null; error: Error | null }> {
  const token = await accessToken();
  if (!token) return { data: null, error: new Error("Please sign in again and retry.") };
  const base = functionsBaseUrl();
  if (!base) return { data: null, error: new Error("VITE_SUPABASE_URL missing") };
  if (!ANON_KEY) return { data: null, error: new Error("VITE_SUPABASE_ANON_KEY missing") };

  const res = await fetch(`${base}/functions/v1/pro-plan-cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      reason: params.reason,
      confirm: params.confirm,
    }),
  });
  const raw = await res.text().catch(() => "");
  let parsed = {} as ProPlanCancelResponse & { details?: string };
  if (raw) {
    try {
      parsed = JSON.parse(raw) as ProPlanCancelResponse & { details?: string };
    } catch {
      parsed = {} as ProPlanCancelResponse & { details?: string };
    }
  }
  if (!res.ok) {
    const message = parsed.details ?? parsed.error ?? (raw.trim() || `HTTP ${res.status}`);
    return { data: null, error: new Error(message) };
  }
  return { data: parsed as ProPlanCancelResponse, error: null };
}
