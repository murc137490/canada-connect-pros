import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function supabaseFunctionsBaseUrl(): string {
  const raw = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  return raw.replace(/\/+$/, "");
}

/** Shown when no valid user session exists for Edge Function JWT validation. */
export const PLAN_CHECKOUT_SESSION_ERROR =
  "Your session expired or you are not signed in. Please sign in again and retry the plan change.";

export type PlanCheckoutResponse = {
  ok?: boolean;
  charged_cents?: number;
  new_plan_id?: string;
  error?: string;
  details?: string;
};

function getInvokeErrorMessage(error: { message?: string; context?: { body?: { details?: string; error?: string } } }) {
  const body = error.context?.body;
  const raw = (body?.details ?? body?.error ?? error.message) as string | undefined;
  if (raw && shouldTreat401AsSessionMessage(raw)) return PLAN_CHECKOUT_SESSION_ERROR;
  return raw;
}

/** `functions.invoke` throws FunctionsHttpError with `context` = fetch Response (not parsed body). */
async function messageFromInvokeHttpError(error: unknown): Promise<string | undefined> {
  if (!error || typeof error !== "object") return undefined;
  const ctx = (error as { context?: unknown }).context;
  if (!(ctx instanceof Response)) return undefined;
  const raw = await ctx.text().catch(() => "");
  let msg: string | undefined;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const pick = j.details ?? j.error ?? j.message ?? j.msg;
    msg = typeof pick === "string" ? pick : undefined;
  } catch {
    msg = raw?.trim() ? raw.trim().slice(0, 400) : undefined;
  }
  if (!msg) msg = `HTTP ${ctx.status}`;
  if (ctx.status === 401 && shouldTreat401AsSessionMessage(msg)) return PLAN_CHECKOUT_SESSION_ERROR;
  return msg;
}

/** Map 401 to "sign in again" only for auth/session-style bodies, not config (apikey) or opaque errors. */
function shouldTreat401AsSessionMessage(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (!m) return true;
  if (m.includes("invalid api key") || m.includes("apikey")) return false;
  if (m.includes("forbidden")) return false;
  if (
    m.includes("jwt") ||
    m.includes("unauthorized") ||
    m.includes("session") ||
    m.includes("expired") ||
    m.includes("invalid_grant") ||
    m.startsWith("http 401")
  )
    return true;
  return false;
}

/**
 * Token for Edge Functions: refresh first, then fall back to stored session.
 * We intentionally do **not** require `getUser(jwt)` to succeed here — it can fail transiently
 * or reject a token that `pro-plan-checkout` would still accept, which falsely showed "session expired".
 */
async function getValidAccessToken(): Promise<string | null> {
  const {
    data: { session: initial },
  } = await supabase.auth.getSession();
  if (!initial?.access_token && !initial?.refresh_token) return null;

  const { data: ref } = await supabase.auth.refreshSession();
  const token = ref.session?.access_token ?? initial.access_token;
  return token ?? null;
}

async function invokePlanCheckout(
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ data: PlanCheckoutResponse | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke<PlanCheckoutResponse>("pro-plan-checkout", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON_KEY ?? "",
    },
  });
  if (error) {
    const fromResponse = await messageFromInvokeHttpError(error);
    const msg =
      fromResponse ??
      getInvokeErrorMessage(error as { message?: string; context?: { body?: { details?: string; error?: string } } }) ??
      (error as Error).message ??
      "Request failed";
    return { data: null, error: new Error(msg) };
  }
  return { data: data ?? null, error: null };
}

async function invokePlanCheckoutFetch(
  body: Record<string, unknown>,
  accessToken: string
): Promise<{ data: PlanCheckoutResponse | null; error: Error | null }> {
  const base = supabaseFunctionsBaseUrl();
  if (!base) return { data: null, error: new Error("VITE_SUPABASE_URL missing") };
  if (!ANON_KEY) return { data: null, error: new Error("VITE_SUPABASE_ANON_KEY missing in app configuration.") };

  const url = `${base}/functions/v1/pro-plan-checkout`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: ANON_KEY ?? "",
    },
    body: JSON.stringify(body),
  });
  const rawText = await res.text().catch(() => "");
  let parsed = {} as PlanCheckoutResponse;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as PlanCheckoutResponse;
    } catch {
      parsed = {};
    }
  }
  if (!res.ok) {
    const hint = parsed.details ?? parsed.error ?? (rawText.trim() ? rawText.trim().slice(0, 400) : "");
    if (res.status === 401) {
      const msg = shouldTreat401AsSessionMessage(hint || `HTTP ${res.status}`) ? PLAN_CHECKOUT_SESSION_ERROR : hint || `HTTP ${res.status}`;
      return { data: null, error: new Error(msg) };
    }
    return { data: null, error: new Error(hint || `HTTP ${res.status}`) };
  }
  return { data: parsed, error: null };
}

export async function submitPlanCheckout(body: Record<string, unknown>): Promise<{ data: PlanCheckoutResponse | null; error: Error | null }> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return { data: null, error: new Error(PLAN_CHECKOUT_SESSION_ERROR) };
  }

  // Prefer explicit fetch (apikey + Authorization) — matches Supabase docs and avoids invoke header edge cases.
  const viaFetch = await invokePlanCheckoutFetch(body, accessToken);
  if (!viaFetch.error) return viaFetch;

  const viaInvoke = await invokePlanCheckout(body, accessToken);
  if (!viaInvoke.error) return viaInvoke;

  const genericInvoke = viaInvoke.error.message === "Edge Function returned a non-2xx status code";
  if (genericInvoke && viaFetch.error.message) {
    return { data: null, error: new Error(viaFetch.error.message) };
  }
  return viaInvoke;
}
