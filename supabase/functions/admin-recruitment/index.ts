import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const httpsUrl = (value: unknown, max: number) => { const raw = clip(value, max); if (!raw) return null; try { const url = new URL(raw); return url.protocol === "https:" ? url.toString() : null; } catch { return null; } };
const response = (body: unknown, status = 200, origin = "https://www.altshift.ca") => new Response(JSON.stringify(body), { status, headers: { ...headers, "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" } });

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: "AltShift <grok@altshift.com>", reply_to: "grok@altshift.com", to: [to], subject, html }) });
  if (!res.ok) console.error("Recruitment email delivery failed", res.status, await res.text());
  return res.ok;
}

function emailHtml(body: string) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">${body.split(/\n{2,}/).map((paragraph) => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = /^https:\/\/(www\.)?altshift\.ca$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin) ? origin : "https://www.altshift.ca";
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...headers, "Access-Control-Allow-Origin": allowed } });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, allowed);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return response({ error: "Server unavailable" }, 503, allowed);
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) return response({ error: "Unauthorized" }, 401, allowed);
  const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(auth);
  if (authError || !user) return response({ error: "Unauthorized" }, 401, allowed);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await db.from("profiles").select("is_platform_admin").eq("user_id", user.id).maybeSingle();
  const normalizedEmail = (user.email ?? "").trim().toLowerCase();
  if (profile?.is_platform_admin !== true && !["murc137490@gmail.com", "premiereservicescontact@gmail.com"].includes(normalizedEmail)) return response({ error: "Forbidden" }, 403, allowed);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ error: "Invalid JSON" }, 400, allowed); }
  const action = clip(body.action, 24);

  if (action === "list") {
    const [{ data: contactRows, error: contactError }, { data: drafts, error: draftError }, { data: replies, error: replyError }] = await Promise.all([
      db.from("professional_recruitment_contacts").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("professional_recruitment_email_drafts").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("professional_recruitment_replies").select("*").order("received_at", { ascending: false }).limit(100),
    ]);
    return contactError || draftError || replyError ? response({ error: "Unable to load recruitment data" }, 500, allowed) : response({ contacts: contactRows ?? [], drafts: drafts ?? [], replies: replies ?? [] }, 200, allowed);
  }

  if (action === "save") {
    const id = clip(body.id, 50);
    const row = {
      first_name: clip(body.first_name, 100), last_name: clip(body.last_name, 100) || null,
      business_name: clip(body.business_name, 180) || null, email: clip(body.email, 254).toLowerCase() || null,
      phone: clip(body.phone, 40) || null, website: httpsUrl(body.website, 500),
      locale: body.locale === "en" ? "en" : "fr", notes: clip(body.notes, 5000) || null,
      meeting_at: clip(body.meeting_at, 50) || null, meeting_url: httpsUrl(body.meeting_url, 1000), updated_at: new Date().toISOString(),
    };
    if (!row.first_name) return response({ error: "First name is required" }, 400, allowed);
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return response({ error: "Enter a valid email address" }, 400, allowed);
    const query = id
      ? db.from("professional_recruitment_contacts").update(row).eq("id", id).select("*").single()
      : db.from("professional_recruitment_contacts").insert({ ...row, created_by: user.id }).select("*").single();
    const { data, error } = await query;
    return error ? response({ error: "Unable to save contact" }, 500, allowed) : response({ contact: data }, 200, allowed);
  }

  if (action === "delete") {
    const id = clip(body.id, 50);
    const { error } = await db.from("professional_recruitment_contacts").delete().eq("id", id);
    return error ? response({ error: "Unable to delete contact" }, 500, allowed) : response({ ok: true }, 200, allowed);
  }

  if (action === "save_manual_draft") {
    const id = clip(body.id, 50), template = body.template === "post_call" ? "post_call" : "first_contact";
    const subject = clip(body.subject, 240), message = clip(body.body, 20000);
    if (!id || !subject || !message) return response({ error: "Add the subject and email from Grok first." }, 200, allowed);
    const { data: contact, error: contactError } = await db.from("professional_recruitment_contacts").select("*").eq("id", id).single();
    if (contactError || !contact?.email) return response({ error: "Save a valid email address for this contact first." }, 200, allowed);
    const { data: draft, error: draftError } = await db.from("professional_recruitment_email_drafts").insert({
      contact_id: contact.id, template, recipient_email: contact.email, subject, body: message, created_by: user.id,
    }).select("*").single();
    if (draftError || !draft) return response({ error: "Could not save the draft." }, 200, allowed);

    const approvalEmail = "grokistgutgenug@gmail.com";
    const reviewUrl = `https://www.altshift.ca/dashboard?tab=recruitment&draft=${encodeURIComponent(draft.id)}`;
    const title = contact.locale === "fr" ? "Un courriel de recrutement attend votre approbation" : "A recruitment email is ready for your approval";
    const notice = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><p>${contact.locale === "fr" ? "Grok a préparé un brouillon pour" : "Grok drafted an email for"} ${esc(`${contact.first_name} ${contact.last_name ?? ""}`.trim())}${contact.business_name ? ` · ${esc(contact.business_name)}` : ""}.</p><p><b>${contact.locale === "fr" ? "Destinataire" : "Recipient"}:</b> ${esc(contact.email)}<br><b>${contact.locale === "fr" ? "Objet" : "Subject"}:</b> ${esc(subject)}</p><p>${contact.locale === "fr" ? "Ouvrez Recrutement, relisez le brouillon et approuvez-le pour envoyer." : "Open Recruitment, review the draft, and approve it to send."}</p><p><a href="${reviewUrl}">${contact.locale === "fr" ? "Réviser le brouillon" : "Review draft"}</a></p></div>`;
    let noticeSent = false;
    try { noticeSent = await sendEmail(approvalEmail, title, notice); } catch { console.error("Recruitment approval notice failed"); }
    return response({ draft, approval_notice_sent: noticeSent }, 200, allowed);
  }

  if (action === "draft") return response({ error: "Use the Grok chatbot prompt workflow to create this draft." }, 200, allowed);
  if (action === "update_draft") {
    const id = clip(body.id, 50), subject = clip(body.subject, 240), message = clip(body.body, 20000);
    if (!id || !subject || !message) return response({ error: "Subject and message are required" }, 400, allowed);
    const { data, error } = await db.from("professional_recruitment_email_drafts").update({ subject, body: message, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
    return error || !data ? response({ error: "Draft is no longer available to edit" }, 409, allowed) : response({ draft: data }, 200, allowed);
  }

  if (action === "reject_draft") {
    const id = clip(body.id, 50);
    const { data, error } = await db.from("professional_recruitment_email_drafts").update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
    return error || !data ? response({ error: "Draft is no longer pending" }, 409, allowed) : response({ ok: true }, 200, allowed);
  }

  if (action === "approve_draft") {
    const id = clip(body.id, 50);
    const { data: draft, error: claimError } = await db.from("professional_recruitment_email_drafts").update({ status: "sending", reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
    if (claimError || !draft) return response({ error: "Draft is no longer pending" }, 409, allowed);
    let sent = false;
    try { sent = await sendEmail(draft.recipient_email, draft.subject, emailHtml(draft.body)); } catch (e) { console.error("Approved recruitment email failed", e); }
    if (!sent) {
      await db.from("professional_recruitment_email_drafts").update({ status: "pending", reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "sending");
      return response({ error: "Email could not be sent. Check Resend configuration; the draft remains pending." }, 502, allowed);
    }
    const now = new Date().toISOString();
    await db.from("professional_recruitment_email_drafts").update({ status: "sent", sent_at: now, updated_at: now }).eq("id", id).eq("status", "sending");
    await db.from("professional_recruitment_contacts").update({ last_email_template: draft.template, last_email_sent_at: now, updated_at: now }).eq("id", draft.contact_id);
    return response({ ok: true }, 200, allowed);
  }

  if (action === "send") return response({ error: "Direct sending is disabled. Generate a draft and approve it first." }, 403, allowed);
  return response({ error: "Unknown action" }, 400, allowed);
});
