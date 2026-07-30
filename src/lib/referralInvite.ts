import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errorMessage";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export async function referralInvite(
  action: "list" | "send" | "claim" | "validate_code" | "redeem_code",
  params: Record<string, unknown> = {}
) {
  const token = await accessToken();
  if (!token) return { data: null, error: new Error("Please sign in again and retry.") };
  const base = functionsBaseUrl();
  if (!base) return { data: null, error: new Error("VITE_SUPABASE_URL missing") };
  if (!ANON_KEY) return { data: null, error: new Error("VITE_SUPABASE_ANON_KEY missing") };

  try {
    const res = await fetch(`${base}/functions/v1/referral-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ action, ...params }),
    });

    const raw = await res.text().catch(() => "");
    let parsed: ReferralInviteResponse = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as ReferralInviteResponse;
      } catch {
        parsed = {};
      }
    }

    if (!res.ok) {
      const piece =
        parsed.error != null
          ? errorMessage(parsed.error)
          : parsed.details != null
            ? errorMessage(parsed.details)
            : raw.trim()
              ? raw.trim()
              : "";
      const msg = piece || `HTTP ${res.status}`;
      return { data: null, error: new Error(msg) };
    }

    return { data: parsed, error: null };
  } catch (error) {
    const message = errorMessage(error);
    const looksLikeNetwork =
      /network|fetch|failed to fetch|cors|load failed|aborted/i.test(message) ||
      error instanceof TypeError;
    if (looksLikeNetwork) {
      const refHint =
        /https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(functionsBaseUrl())?.[1] ??
        "YOUR_PROJECT_REF";
      return {
        data: null,
        error: new Error(
          `Could not reach the referral-invite Edge Function (network or 404). Fix: (1) Deploy: run "supabase login" then "supabase functions deploy referral-invite --project-ref ${refHint}" from the repo root (or create function "referral-invite" in Dashboard → Edge Functions and paste supabase/functions/referral-invite/index.ts). (2) Ensure VITE_SUPABASE_URL in your app matches that project (e.g. https://${refHint}.supabase.co). (3) In Dashboard → Edge Functions → Secrets, set SUPABASE_SERVICE_ROLE_KEY (and SMTP_* or RESEND_API_KEY for sending invites).`
        ),
      };
    }
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
}
