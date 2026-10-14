import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callerIsPlatformModerator } from "../_shared/platformAdmin.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";
import { sendBrandEmail } from "../_shared/sendBrandEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(withCorsAllowlist(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Server misconfigured" }, 500);

  try {
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    if (!(await callerIsPlatformModerator(admin, user.id, user.email))) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const proUserId = typeof body.pro_user_id === "string" ? body.pro_user_id.trim() : "";
    const note = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!proUserId || note.length < 3) return json({ error: "Applicant and a clear missing-information note are required" }, 400);

    const { data: profile, error: profileError } = await admin.from("pro_profiles")
      .select("business_name, is_verified")
      .eq("user_id", proUserId).maybeSingle();
    if (profileError || !profile) return json({ error: profileError?.message ?? "Application not found" }, 404);
    if (profile.is_verified) return json({ error: "This application has already been approved" }, 409);

    const { error: noticeError } = await admin.from("pro_application_review_notices").insert({
      user_id: proUserId,
      decision: "needs_info",
      review_note: note,
    });
    if (noticeError) return json({ error: noticeError.message }, 500);

    let emailSent = false;
    const { data: authUser } = await admin.auth.admin.getUserById(proUserId);
    const toEmail = authUser.user?.email;
    if (toEmail) {
      const businessName = escapeHtml(profile.business_name ?? "AltShift");
      const safeNote = escapeHtml(note).replace(/\n/g, "<br>");
      const href = "https://www.altshift.ca/dashboard?tab=account";
      const html = `<p>Your professional application for <strong>${businessName}</strong> needs a few updates before it can be reviewed again.</p><p><strong>Information requested:</strong><br>${safeNote}</p><p><a href="${href}">Open your account to update your application</a></p><hr><p>Votre demande de compte professionnel pour <strong>${businessName}</strong> nécessite quelques précisions avant de poursuivre l’examen.</p><p><strong>Renseignements demandés :</strong><br>${safeNote}</p><p><a href="${href}">Ouvrir votre compte pour mettre à jour votre demande</a></p>`;
      emailSent = await sendBrandEmail(toEmail, "AltShift | More information needed / Renseignements supplémentaires", html);
    }

    return json({ ok: true, email_sent: emailSent, notice_saved: true });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
}));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}
