import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200, origin = "https://www.altshift.ca") => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" },
});
const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = /^https:\/\/(www\.)?altshift\.ca$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin) ? origin : "https://www.altshift.ca";
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Origin": allowedOrigin } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, allowedOrigin);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Service unavailable" }, 503, allowedOrigin);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string | null = null;
  const authorization = req.headers.get("Authorization");
  if (authorization) {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return json({ error: "Invalid session" }, 401, allowedOrigin);
    userId = data.user.id;
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400, allowedOrigin); }
  const target = body.target;
  const otherTarget = clip(body.other_target, 100);
  const issue = clip(body.issue, 3000);
  const solution = clip(body.solution, 3000);
  if (!["client", "professional", "other"].includes(String(target))) return json({ error: "Invalid recommendation topic" }, 400, allowedOrigin);
  if (String(target) === "other" && otherTarget.length < 2) return json({ error: "Add a topic" }, 400, allowedOrigin);
  if (issue.length < 8) return json({ error: "Describe the issue or idea" }, 400, allowedOrigin);

  if (target === "professional") {
    if (!userId) return json({ error: "A professional account is required for this topic" }, 403, allowedOrigin);
    const { data: profile, error } = await admin.from("pro_profiles").select("id").eq("user_id", userId).limit(1).maybeSingle();
    if (error || !profile) return json({ error: "A professional account is required for this topic" }, 403, allowedOrigin);
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(forwarded)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: rateError } = await admin.from("front_desk_tickets").select("id", { count: "exact", head: true }).eq("intake_ip_hash", ipHash).gte("created_at", since);
  if (rateError) return json({ error: "Unable to submit recommendation" }, 503, allowedOrigin);
  if ((count ?? 0) >= 3) return json({ error: "Please wait before sending another recommendation" }, 429, allowedOrigin);

  const topic = target === "professional" ? "professional features" : target === "client" ? "client features" : `other: ${otherTarget}`;
  const formattedBody = [`Topic: ${topic}`, `Issue or idea:\n${issue}`, solution ? `Possible solution:\n${solution}` : ""].filter(Boolean).join("\n\n");
  const { error } = await admin.from("front_desk_tickets").insert({
    customer_user_id: userId,
    kind: "feature_request",
    subject: `About page recommendation: ${topic}`.slice(0, 200),
    body: formattedBody,
    intake_ip_hash: ipHash,
  });
  if (error) return json({ error: "Unable to submit recommendation" }, 503, allowedOrigin);
  return json({ ok: true }, 200, allowedOrigin);
});
