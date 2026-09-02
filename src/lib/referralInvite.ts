import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errorMessage";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type ReferralInvite = {
  id: string;
  invitee_email: string;
  referral_code: string;
  /** Random single-use token; set when the friend completes signup (not the literal "freetrial"). */
  reward_code: string | null;
  reward_days: number;
  status: "pending" | "completed" | "reward_claimed";
  created_at: string;
  accepted_at: string | null;
  claimed_at: string | null;
};

export type ReferralInviteResponse = {
  ok?: boolean;
  email_sent?: boolean;
  claimed?: boolean;
  valid?: boolean;
  plan_id?: "starter" | "growth" | "pro" | string;
  reward_days?: number;
  needs_profile?: boolean;
  promo_code?: string;
  trial_token?: string;
  code_kind?: "referral" | "personal_trial" | string;
  trial_ends_at?: string;
  invites?: ReferralInvite[];
  error?: string;
  details?: string;
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

function parseBody(raw: string): ReferralInviteResponse {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ReferralInviteResponse;
  } catch {
    return {};
  }
}

function errorFromBody(parsed: ReferralInviteResponse, raw: string, status: number): Error {
  const piece =
    parsed.error != null
      ? errorMessage(parsed.error)
      : parsed.details != null
        ? errorMessage(parsed.details)
        : raw.trim()
          ? raw.trim()
          : "";
  if (status === 503) {
    return new Error(
      piece || "Invite service is warming up. Wait a few seconds and try again.",
    );
  }
  if (status === 401) return new Error(piece || "Please sign in again and retry.");
  if (status === 502) {
    return new Error(
      piece ||
        "Invite email could not be sent. Check Edge Function secrets (SMTP_* or RESEND_API_KEY).",
    );
  }
  return new Error(piece || `Invite request failed (HTTP ${status}).`);
}

async function postReferralInvite(
  token: string,
  body: Record<string, unknown>,
): Promise<{ data: ReferralInviteResponse | null; error: Error | null; status?: number }> {
  const base = functionsBaseUrl();
  if (!base) return { data: null, error: new Error("VITE_SUPABASE_URL is missing in this deploy.") };
  if (!ANON_KEY) return { data: null, error: new Error("VITE_SUPABASE_ANON_KEY is missing in this deploy.") };

  const url = `${base}/functions/v1/referral-invite`;
  let lastNetwork: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
          "x-client-info": "premiere-web",
        },
        body: JSON.stringify(body),
      });

      const raw = await res.text().catch(() => "");
      const parsed = parseBody(raw);

      if (res.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      if (!res.ok) {
        return { data: null, error: errorFromBody(parsed, raw, res.status), status: res.status };
      }

      if (parsed.error && parsed.ok !== true) {
        return { data: null, error: new Error(errorMessage(parsed.error)) };
      }

      return { data: parsed, error: null, status: res.status };
    } catch (error) {
      lastNetwork = error;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
    }
  }

  const message = errorMessage(lastNetwork);
  return {
    data: null,
    error: new Error(
      /network|fetch|failed to fetch|cors|load failed|aborted/i.test(message) || lastNetwork instanceof TypeError
        ? `Could not reach invite service at ${url}. Check your connection and try again.`
        : message || "Invite request failed.",
    ),
  };
}

export async function referralInvite(
  action: "list" | "send" | "claim" | "validate_code" | "redeem_code",
  params: Record<string, unknown> = {},
) {
  const token = await accessToken();
  if (!token) return { data: null, error: new Error("Please sign in again and retry.") };
  return postReferralInvite(token, { action, ...params });
}
