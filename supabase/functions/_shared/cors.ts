/**
 * CORS allowlist for browser-called edge functions (security review 2026-10-08, LOW 11).
 *
 * Wrap the handler: `Deno.serve(withCorsAllowlist(async (req) => { ... }))`.
 * Handlers keep building their responses with the old `corsHeaders` object; the wrapper then
 * replaces `Access-Control-Allow-Origin: *` with the caller's origin when it is allowed, or removes
 * it (the browser then blocks the response). Server-to-server callers (no Origin header, cron,
 * webhooks) are unaffected. Responses without an Access-Control-Allow-Origin header are untouched.
 *
 * Allowed: https://www.altshift.ca, https://altshift.ca, http://localhost:5173 / :4173 (Vite dev /
 * preview) and any origin listed in the optional CORS_ALLOWED_ORIGINS secret (comma-separated,
 * e.g. a Vercel preview URL).
 */
const BASE_ALLOWED_ORIGINS = [
  "https://www.altshift.ca",
  "https://altshift.ca",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

export function isAllowedCorsOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const o = origin.trim().replace(/\/+$/, "");
  if (BASE_ALLOWED_ORIGINS.includes(o)) return true;
  const extra = (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return extra.includes(o);
}

export function applyCorsAllowlist(req: Request, res: Response): Response {
  if (!res.headers.has("Access-Control-Allow-Origin")) return res;
  const origin = req.headers.get("Origin");
  const headers = new Headers(res.headers);
  if (isAllowedCorsOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin!.trim().replace(/\/+$/, ""));
  } else {
    headers.delete("Access-Control-Allow-Origin");
  }
  const vary = headers.get("Vary");
  if (!vary || !/\borigin\b/i.test(vary)) headers.set("Vary", vary ? `${vary}, Origin` : "Origin");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function withCorsAllowlist(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => applyCorsAllowlist(req, await handler(req));
}
