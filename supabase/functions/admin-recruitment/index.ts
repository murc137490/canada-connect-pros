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
  const from = (Deno.env.get("FROM_EMAIL") ?? "support@altshift.ca").trim().toLowerCase();
  const sender = /^[a-z0-9._%+-]+@altshift\.ca$/.test(from) ? from : "support@altshift.ca";
  const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `AltShift <${sender}>`, to: [to], subject, html }) });
  if (!res.ok) console.error("Recruitment email delivery failed", res.status, await res.text());
  return res.ok;
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
  const action = clip(body.action, 20);

  if (action === "list") {
    const { data, error } = await db.from("professional_recruitment_contacts").select("*").order("created_at", { ascending: false }).limit(500);
    return error ? response({ error: "Unable to load recruitment contacts" }, 500, allowed) : response({ contacts: data ?? [] }, 200, allowed);
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
  if (action === "send") {
    const id = clip(body.id, 50), template = body.template === "post_call" ? "post_call" : "first_contact";
    const { data: contact, error } = await db.from("professional_recruitment_contacts").select("*").eq("id", id).single();
    if (error || !contact?.email) return response({ error: "Save a valid email address first" }, 400, allowed);
    const name = esc(contact.first_name);
    const business = contact.business_name ? esc(contact.business_name) : "";
    const site = "https://www.altshift.ca";
    const meetingTime = contact.meeting_at
      ? new Date(contact.meeting_at).toLocaleString(contact.locale === "fr" ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", dateStyle: "full", timeStyle: "short" })
      : "";
    const meetUrl = httpsUrl(contact.meeting_url, 1000);
    const meet = contact.locale === "fr"
      ? meetUrl
        ? `<p><b>Rencontre${meetingTime ? ` · ${esc(meetingTime)}` : ""} :</b> <a href="${esc(meetUrl)}">Rejoindre Google Meet</a></p>`
        : meetingTime ? `<p><b>Rencontre prévue :</b> ${esc(meetingTime)} (heure de Québec). Le lien vidéo sera transmis séparément.</p>` : ""
      : meetUrl
        ? `<p><b>Meeting${meetingTime ? ` · ${esc(meetingTime)}` : ""}:</b> <a href="${esc(meetUrl)}">Join Google Meet</a></p>`
        : meetingTime ? `<p><b>Scheduled meeting:</b> ${esc(meetingTime)} (Québec time). The video link will follow separately.</p>` : "";
    let subject: string, content: string;
    if (template === "first_contact") {
      subject = contact.locale === "fr" ? "Découvrir AltShift, une nouvelle plateforme locale" : "Discover AltShift, a new local platform";
      content = contact.locale === "fr"
        ? `<p>Bonjour ${name},</p><p>Je m'appelle Aymen Aissaoui et je suis le fondateur d'AltShift, une nouvelle plateforme québécoise conçue pour aider les professionnels locaux à trouver des clients et à gérer leurs réservations plus simplement${business ? `, notamment ${business}` : ""}.</p><p>Nous préparons notre lancement à Granby et je communique directement avec des professionnels de la région qui pourraient vouloir faire partie des premiers utilisateurs.</p><p>AltShift ne vous facture pas simplement pour recevoir les coordonnées d'un client potentiel. Recevoir une demande, communiquer avec le client et préparer une soumission n'utilise aucun Booking Credit. Les crédits entrent en jeu lorsqu'un travail est réservé sur AltShift.</p><p>Les premiers professionnels de Granby ont accès gratuitement à la plateforme jusqu'au 1er janvier 2027.</p><p>J'aimerais vous présenter AltShift lors d'une courte rencontre d'environ 15 minutes. Répondez à ce courriel avec vos disponibilités et votre préférence, téléphone ou vidéo.</p>${meet}<p><a href="${site}">AltShift</a> · <a href="${site}/#how-it-works">Comment ça marche</a> · <a href="${site}/join-pros">Pour les professionnels</a></p><p>Il n'y a aucun engagement à participer ou à créer un compte.</p><p>Au plaisir d'échanger avec vous,<br>Aymen Aissaoui<br>Fondateur, Services AltShift inc.</p><p><a href="${site}/support">Nous joindre</a> · <a href="${site}/privacy">Confidentialité</a></p>`
        : `<p>Hello ${name},</p><p>I'm Aymen Aissaoui, founder of AltShift, a new Québec platform designed to help local professionals find clients and manage bookings more easily${business ? `, including businesses like ${business}` : ""}.</p><p>We're preparing our launch in Granby and reaching out directly to local professionals who may want to join the first group on the platform.</p><p>AltShift does not charge you simply to receive a potential client's contact details. Requests, client communication, and quotes do not use Booking Credits. Credits apply when eligible work is booked through AltShift.</p><p>Granby's first professionals have free access to the platform until January 1, 2027.</p><p>I'd be glad to introduce AltShift in a short, 15-minute meeting. Reply with your availability and whether you prefer phone or video.</p>${meet}<p><a href="${site}">AltShift</a> · <a href="${site}/#how-it-works">How it works</a> · <a href="${site}/join-pros">For professionals</a></p><p>There is no commitment to attend or create an account.</p><p>Best,<br>Aymen Aissaoui<br>Founder, Services AltShift inc.</p><p><a href="${site}/support">Contact</a> · <a href="${site}/privacy">Privacy</a></p>`;
    } else {
      subject = contact.locale === "fr" ? "Comme promis : les informations sur AltShift" : "As promised: information about AltShift";
      const { data: plans } = await db.from("subscription_plans").select("id,name,price_cents,monthly_booking_credits").in("id", ["starter", "growth", "pro"]);
      const { data: refills } = await db.from("booking_credit_refill_prices").select("plan_id,credit_amount,price_cents").order("credit_amount");
      const planRows = (plans ?? []).map((p) => `<li><b>${esc(p.name)} — $${(Number(p.price_cents) / 100).toFixed(0)}/mois</b>: ${p.monthly_booking_credits} crédits mensuels</li>`).join("");
      const refillRows = ["starter", "growth", "pro"].map((tier) => {
        const rows = (refills ?? []).filter((r) => r.plan_id === tier).map((r) => `${r.credit_amount} — $${(Number(r.price_cents) / 100).toFixed(2)}`).join(" · ");
        return `<li><b>${tier.toUpperCase()}:</b> ${rows}</li>`;
      }).join("");
      const creditConfig = await db.from("booking_credit_config").select("coverage_cents, max_credits_per_booking").eq("id", true).maybeSingle();
      const coverage = Math.max(1, Number(creditConfig.data?.coverage_cents ?? 10000));
      const cap = Math.max(1, Number(creditConfig.data?.max_credits_per_booking ?? 100));
      const examples = [75, 100, 250, 500, 800, 1000, 2500, 5000, 10000, 15000]
        .map((amount) => `${new Intl.NumberFormat(contact.locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(amount)} → ${Math.min(cap, Math.ceil((amount * 100) / coverage))} ${contact.locale === "fr" ? "crédit(s)" : "credit(s)"}`)
        .join(" · ");
      const signup = `${site}/auth?mode=signup&redirect=%2Fcreate-pro-account%3Fonboarding%3D1`;
      const links = contact.locale === "fr"
        ? `<p><a href="${signup}">Créer votre compte professionnel</a> · <a href="${site}/pro-plans">Comparer les forfaits</a> · <a href="${site}/#how-it-works">Découvrir AltShift</a></p><p><a href="${site}/help/dashboard-guide">Guide et FAQ</a> · <a href="${site}/terms">Conditions et annulation</a> · <a href="${site}/privacy">Confidentialité</a> · <a href="${site}/support">Nous joindre</a></p>`
        : `<p><a href="${signup}">Create your professional account</a> · <a href="${site}/pro-plans">Compare plans</a> · <a href="${site}/#how-it-works">Discover AltShift</a></p><p><a href="${site}/help/dashboard-guide">Guide and FAQ</a> · <a href="${site}/terms">Terms and cancellations</a> · <a href="${site}/privacy">Privacy</a> · <a href="${site}/support">Contact</a></p>`;
      content = contact.locale === "fr"
        ? `<p>Bonjour ${name},</p><p>Merci d'avoir pris le temps de discuter avec moi${business ? ` au sujet de ${business}` : ""}. Comme promis, voici les informations sur AltShift, l'offre de lancement, les forfaits et les Booking Credits.</p><h3>Offre de lancement à Granby</h3><p>Votre accès à AltShift est gratuit jusqu'au 1er janvier 2027. Vous pouvez créer votre profil, découvrir les outils et commencer à utiliser la plateforme avant de choisir un abonnement payant.</p><h3>Comment fonctionnent les Booking Credits?</h3><p>Recevoir ou consulter une demande, communiquer avec un client et envoyer une soumission ne consomme aucun crédit. Les crédits sont utilisés lorsqu'un travail admissible est réservé sur AltShift. Un crédit couvre jusqu'à ${(coverage / 100).toFixed(0)} $ de valeur de service et une réservation utilise au maximum ${cap} crédits.</p><p>${examples}</p><h3>Forfaits mensuels</h3><ul>${planRows}</ul><h3>Recharges de crédits</h3><p>Des crédits supplémentaires sont offerts selon le forfait choisi. Les prix sont ceux actuellement configurés dans AltShift :</p><ul>${refillRows}</ul><p>Les règles de renouvellement, de solde et de changement de forfait sont affichées dans AltShift au moment de l'achat. Vous pourrez consulter le solde et l'activité dans votre tableau de bord.</p><h3>Pourquoi commencer à Granby?</h3><p>Nous lançons AltShift dans une première région pour bâtir un réseau local, recueillir les commentaires et améliorer la plateforme avec les professionnels qui l'utilisent.</p>${links}${meet}<p>Répondez simplement à ce courriel si vous avez des questions. Je serai heureux de vous accompagner dans la création de votre compte.</p><p>Merci encore pour votre temps et au plaisir de vous compter parmi les premiers professionnels AltShift.<br>Aymen Aissaoui<br>Fondateur, Services AltShift inc.<br><a href="${site}">altshift.ca</a></p>`
        : `<p>Hello ${name},</p><p>Thanks for taking the time to speak with me${business ? ` about ${business}` : ""}. As promised, here is information about AltShift, our launch offer, plans, and Booking Credits.</p><h3>Granby launch offer</h3><p>Your access to AltShift is free until January 1, 2027. You can create your profile, explore the tools, and start using the platform before choosing a paid subscription.</p><h3>How Booking Credits work</h3><p>Receiving or viewing a request, messaging a client, and sending a quote do not use credits. Credits are used when eligible work is booked through AltShift. One credit covers up to CA$${(coverage / 100).toFixed(0)} in service value, and a booking uses at most ${cap} credits.</p><p>${examples}</p><h3>Monthly plans</h3><ul>${planRows}</ul><h3>Credit refills</h3><p>Additional credits are available according to your plan. These prices come from AltShift's current pricing configuration:</p><ul>${refillRows}</ul><p>Renewal, balance, and plan-change rules are shown in AltShift at checkout. You can review your balance and activity in your dashboard.</p><h3>Why start in Granby?</h3><p>We are launching in one region first to build a local network, hear from professionals, and improve AltShift with the people using it.</p>${links}${meet}<p>Simply reply to this email if you have questions. I would be glad to help you create your account.</p><p>Thanks again for your time. I look forward to welcoming you among AltShift's first professionals.<br>Aymen Aissaoui<br>Founder, Services AltShift inc.<br><a href="${site}">altshift.ca</a></p>`;
    }
    let sent = false;
    try { sent = await sendEmail(contact.email, subject, `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">${content}</div>`); } catch (error) { console.error("Recruitment email failed", error); }
    if (!sent) return response({ error: "Email could not be sent. Check Resend or SMTP configuration." }, 502, allowed);
    await db.from("professional_recruitment_contacts").update({ last_email_template: template, last_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    return response({ ok: true }, 200, allowed);
  }
  return response({ error: "Unknown action" }, 400, allowed);
});
