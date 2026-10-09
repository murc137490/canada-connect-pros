/**
 * Client helpers for "log in with Member ID or username".
 * The edge function resolves the account server-side and only returns a session.
 */

export type LoginIdentifierKind = "member_id" | "username";

export const LOGIN_INVALID_CREDENTIALS = "LOGIN_INVALID_CREDENTIALS";
export const LOGIN_INVALID_TRY_MEMBER_ID = "LOGIN_INVALID_TRY_MEMBER_ID";
export const LOGIN_TOO_MANY_ATTEMPTS = "LOGIN_TOO_MANY_ATTEMPTS";
export const LOGIN_EMAIL_NOT_CONFIRMED = "LOGIN_EMAIL_NOT_CONFIRMED";
export const LOGIN_UNAVAILABLE = "LOGIN_UNAVAILABLE";

const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

/** Mirrors the server: "#1234" / "12 34" → member ID, "@Jane.Doe" → username. */
export function classifyLoginIdentifier(raw: string): { kind: LoginIdentifierKind; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 64 || (trimmed.includes("@") && !trimmed.startsWith("@"))) return null;
  const digits = trimmed.replace(/[\s#-]/g, "");
  if (/^\d+$/.test(digits)) return /^\d{4,5}$/.test(digits) ? { kind: "member_id", value: digits } : null;
  const username = trimmed.replace(/^@/, "").toLowerCase();
  return USERNAME_RE.test(username) ? { kind: "username", value: username } : null;
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(raw.trim().toLowerCase());
}

/** Suggest a username from a full name (accents stripped, "jean.tremblay"). */
export function suggestUsername(fullName: string): string {
  const base = fullName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 24);
  return base.length >= 3 ? base : "";
}

export type IdentifierSession = {
  access_token: string;
  refresh_token: string;
  login_kind?: LoginIdentifierKind;
};

export async function requestIdentifierSession(identifier: string, password: string): Promise<IdentifierSession> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anon) throw new Error(LOGIN_UNAVAILABLE);

  let res: Response;
  try {
    res = await fetch(`${url}/functions/v1/login-with-identifier`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(LOGIN_UNAVAILABLE);
  }

  const body = (await res.json().catch(() => ({}))) as Partial<IdentifierSession> & {
    error?: string;
    hint?: string;
  };
  if (res.ok && body.access_token && body.refresh_token) {
    return { access_token: body.access_token, refresh_token: body.refresh_token, login_kind: body.login_kind };
  }
  if (res.status === 429 || body.error === "too_many_attempts") throw new Error(LOGIN_TOO_MANY_ATTEMPTS);
  if (body.error === "email_not_confirmed") throw new Error(LOGIN_EMAIL_NOT_CONFIRMED);
  if (body.error === "invalid_credentials") {
    throw new Error(body.hint === "try_member_id" ? LOGIN_INVALID_TRY_MEMBER_ID : LOGIN_INVALID_CREDENTIALS);
  }
  throw new Error(LOGIN_UNAVAILABLE);
}
