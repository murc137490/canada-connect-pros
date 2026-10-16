import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const bytesToBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

async function validSignature(req: Request, raw: string, secret: string) {
  const id = req.headers.get("svix-id"), timestamp = req.headers.get("svix-timestamp"), signatures = req.headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const encodedSecret = secret.replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try { keyBytes = Uint8Array.from(atob(encodedSecret), (char) => char.charCodeAt(0)); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const expected = bytesToBase64(digest);
  return signatures.split(" ").some((value) => {
    const [version, signature] = value.split(",", 2);
    if (version !== "v1" || !signature || signature.length !== expected.length) return false;
    const a = new TextEncoder().encode(signature), b = new TextEncoder().encode(expected);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  });
}

function emailAddress(value: unknown) {
  const raw = String(value ?? "").trim();
  const bracketed = raw.match(/<([^<>]+)>/);
  const address = (bracketed?.[1] ?? raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : null;
}

function plainText(value: unknown, html: unknown) {
  const text = String(value ?? "").trim();
  if (text) return text.slice(0, 20000);
  return String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|br|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").trim().slice(0, 20000);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET")?.trim();
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !resendKey || !url || !serviceKey) return json({ error: "Inbound mail is not configured" }, 503);

  const raw = await req.text();
  if (raw.length > 1_000_000 || !await validSignature(req, raw, secret)) return json({ error: "Invalid webhook signature" }, 401);
  let event: Record<string, unknown>;
  try { event = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: "Invalid JSON" }, 400); }
  if (event.type !== "email.received") return json({ ok: true, ignored: true });
  const data = event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : {};
  const emailId = String(data.email_id ?? "").trim();
  if (!emailId || emailId.length > 100) return json({ error: "Missing email id" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await db.from("professional_recruitment_replies").select("id").eq("resend_email_id", emailId).maybeSingle();
  if (existing.data) return json({ ok: true, duplicate: true });

  const sender = emailAddress(data.from);
  if (!sender) return json({ ok: true, ignored: true });
  const { data: contact } = await db.from("professional_recruitment_contacts").select("id,email").ilike("email", sender).maybeSingle();
  // Only capture replies from a prospect already tracked in Recruitment.
  if (!contact) return json({ ok: true, ignored: true });

  const receivedResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (!receivedResponse.ok) {
    console.error("Could not retrieve Recruitment reply", receivedResponse.status);
    return json({ error: "Could not retrieve received email" }, 502);
  }
  const receivedPayload = await receivedResponse.json() as Record<string, unknown>;
  const received = receivedPayload.data && typeof receivedPayload.data === "object" ? receivedPayload.data as Record<string, unknown> : receivedPayload;
  const body = plainText(received.text, received.html);
  const recipientValues = Array.isArray(data.to) ? data.to : [];
  const recipientEmails = recipientValues.map(emailAddress).filter((value): value is string => Boolean(value)).slice(0, 10);
  const { data: sentDraft } = await db.from("professional_recruitment_email_drafts").select("id")
    .eq("contact_id", contact.id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle();

  const { error } = await db.from("professional_recruitment_replies").upsert({
    resend_email_id: emailId,
    resend_webhook_id: req.headers.get("svix-id"),
    contact_id: contact.id,
    draft_id: sentDraft?.id ?? null,
    sender_email: sender,
    recipient_emails: recipientEmails,
    subject: String(data.subject ?? received.subject ?? "").slice(0, 500),
    body_text: body,
    message_id: String(data.message_id ?? "").slice(0, 500) || null,
    received_at: String(data.created_at ?? event.created_at ?? new Date().toISOString()),
  }, { onConflict: "resend_email_id", ignoreDuplicates: true });
  if (error) {
    console.error("Could not save Recruitment reply", error.message);
    return json({ error: "Could not save received email" }, 500);
  }
  return json({ ok: true });
});
