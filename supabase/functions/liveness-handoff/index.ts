import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigin = (origin: string) => /^https:\/\/(www\.)?altshift\.ca$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin);
const challengeList = [
  "Look at the camera, then slowly turn your head left and back to centre.",
  "Look at the camera, blink twice, then smile.",
  "Look at the camera, turn your head right and back to centre.",
];
const challengeListFr = [
  "Regardez la caméra, tournez lentement la tête à gauche, puis revenez au centre.",
  "Regardez la caméra, clignez des yeux deux fois, puis souriez.",
  "Regardez la caméra, tournez la tête à droite, puis revenez au centre.",
];

function json(body: unknown, status = 200, origin = "https://www.altshift.ca") {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
function tokenHash(token: string) { return crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)).then(async (hash) => [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("")); }
function newToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && !allowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403);
  const corsOrigin = origin || "https://www.altshift.ca";
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": corsOrigin, "Vary": "Origin", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsOrigin);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server configuration unavailable" }, 503, corsOrigin);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  let ownerId: string | null = null;
  if (["create", "status", "consume"].includes(action)) {
    if (!bearer) return json({ error: "Sign in required" }, 401, corsOrigin);
    const authClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${bearer}` } } });
    const { data: { user }, error } = await authClient.auth.getUser(bearer);
    if (error || !user) return json({ error: "Sign in required" }, 401, corsOrigin);
    ownerId = user.id;
  }

  if (action === "create") {
    await admin.from("pro_liveness_handoffs").delete().eq("user_id", ownerId).eq("status", "pending");
    const handoffToken = newToken();
    const challengeIndex = crypto.getRandomValues(new Uint32Array(1))[0] % challengeList.length;
    const locale = body.locale === "fr" ? "fr" : "en";
    const challenge = (locale === "fr" ? challengeListFr : challengeList)[challengeIndex];
    const { data, error } = await admin.from("pro_liveness_handoffs").insert({
      user_id: ownerId,
      token_hash: await tokenHash(handoffToken),
      challenge,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }).select("id,expires_at").single();
    if (error || !data) return json({ error: "Could not create handoff" }, 500, corsOrigin);
    return json({ handoffId: data.id, token: handoffToken, challenge, expiresAt: data.expires_at }, 200, corsOrigin);
  }

  if (action === "challenge" || action === "upload-url" || action === "complete") {
    const token = typeof body.token === "string" ? body.token : "";
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "Invalid or expired handoff" }, 400, corsOrigin);
    const hash = await tokenHash(token);
    const { data: handoff } = await admin.from("pro_liveness_handoffs").select("id,user_id,challenge,status,expires_at,storage_path").eq("token_hash", hash).maybeSingle();
    if (!handoff || handoff.status !== "pending" || Date.parse(handoff.expires_at) <= Date.now()) return json({ error: "This QR code has expired. Create a new one on your computer." }, 410, corsOrigin);
    const ext = body.mimeType === "video/mp4" ? "mp4" : "webm";
    const path = `${handoff.user_id}/verification/liveness-handoffs/${handoff.id}.${ext}`;
    if (action === "challenge") return json({ challenge: handoff.challenge }, 200, corsOrigin);
    if (action === "upload-url") {
      const mimeType = body.mimeType === "video/mp4" ? "video/mp4" : body.mimeType === "video/webm" ? "video/webm" : "";
      const size = Number(body.size);
      if (!mimeType || !Number.isFinite(size) || size < 1 || size > 25 * 1024 * 1024) return json({ error: "Upload a video no larger than 25 MB." }, 400, corsOrigin);
      const { data, error } = await admin.storage.from("pro-verification").createSignedUploadUrl(path, { upsert: true });
      if (error || !data) return json({ error: "Could not prepare the private video upload" }, 500, corsOrigin);
      return json({ path, token: data.token, challenge: handoff.challenge, mimeType }, 200, corsOrigin);
    }
    const directory = `${handoff.user_id}/verification/liveness-handoffs`;
    const { data: files, error: listError } = await admin.storage.from("pro-verification").list(directory, { limit: 20, search: handoff.id });
    const uploaded = files?.find((file) => file.name === `${handoff.id}.webm` || file.name === `${handoff.id}.mp4`);
    const fileSize = Number(uploaded?.metadata?.size ?? 0);
    if (listError || !uploaded || fileSize < 1 || fileSize > 25 * 1024 * 1024) return json({ error: "The video upload could not be verified." }, 400, corsOrigin);
    const mimeType = uploaded.name.endsWith(".mp4") ? "video/mp4" : "video/webm";
    const { error } = await admin.from("pro_liveness_handoffs").update({ status: "uploaded", storage_path: `${directory}/${uploaded.name}`, mime_type: mimeType, completed_at: new Date().toISOString() }).eq("id", handoff.id).eq("status", "pending");
    if (error) return json({ error: "Could not complete the upload" }, 500, corsOrigin);
    return json({ ok: true }, 200, corsOrigin);
  }

  if (action === "status") {
    const { data } = await admin.from("pro_liveness_handoffs").select("status,challenge,expires_at").eq("id", body.handoffId).eq("user_id", ownerId).maybeSingle();
    if (!data || data.status === "consumed") return json({ error: "Handoff not found" }, 404, corsOrigin);
    if (Date.parse(data.expires_at) <= Date.now() && data.status !== "uploaded") return json({ error: "Handoff expired" }, 410, corsOrigin);
    return json({ status: data.status, challenge: data.challenge }, 200, corsOrigin);
  }

  if (action === "consume") {
    const handoffId = String(body.handoffId ?? "");
    const profileId = String(body.profileId ?? "");
    const { data: profile } = await admin.from("pro_profiles").select("id").eq("id", profileId).eq("user_id", ownerId).maybeSingle();
    if (!profile) return json({ error: "Profile does not belong to this account" }, 403, corsOrigin);
    const { data: handoff } = await admin.from("pro_liveness_handoffs").select("id,storage_path,challenge,status").eq("id", handoffId).eq("user_id", ownerId).maybeSingle();
    if (!handoff || handoff.status !== "uploaded" || !handoff.storage_path) return json({ error: "The phone recording expired. Please capture it again." }, 410, corsOrigin);
    const { data: claimed, error: claimError } = await admin.from("pro_liveness_handoffs").update({ status: "consumed", consumed_at: new Date().toISOString() }).eq("id", handoff.id).eq("user_id", ownerId).eq("status", "uploaded").select("id").maybeSingle();
    if (claimError || !claimed) return json({ error: "This recording has already been used" }, 409, corsOrigin);
    const { error: docError } = await admin.from("pro_verification_documents").insert({
      pro_profile_id: profileId,
      document_type: "liveness_video",
      storage_path: handoff.storage_path,
      status: "pending_review",
      extracted_fields: { review_method: "manual", capture_challenge: handoff.challenge, capture_source: "phone_qr" },
    });
    if (docError) {
      await admin.from("pro_liveness_handoffs").update({ status: "uploaded", consumed_at: null }).eq("id", handoff.id).eq("status", "consumed");
      return json({ error: "Could not attach the recording to the application" }, 500, corsOrigin);
    }
    return json({ ok: true }, 200, corsOrigin);
  }

  return json({ error: "Unknown action" }, 400, corsOrigin);
});
