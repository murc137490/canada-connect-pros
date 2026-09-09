/**
 * Account Deletion Flow
 * - request: Authenticated user requests deletion -> generates secure token, schedules deletion in 24h, sends confirmation email via Resend
 * - confirm: Public token confirmation link -> sets status = confirmed, schedules permanent deletion in 24 hours
 * - cancel: Authenticated user cancels their pending/confirmed deletion request
 * - status: Authenticated user checks status of their deletion request
 * - execute: Admin or scheduler executes permanent purge (storage files + auth.users deletion)
 * - admin_list: Admins view all deletion requests
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "support@premiereservices.ca";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "Première Services";
const SITE_URL = (Deno.env.get("SITE_URL") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.premiereservices.ca").replace(/\/+$/, "");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendResendEmail(toEmail: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping email send to:", toEmail);
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }
  const from = `${FROM_NAME} <${FROM_EMAIL}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        reply_to: FROM_EMAIL,
        subject,
        html,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("Resend send failed:", text);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err) {
    console.error("Resend error:", err);
    return { ok: false, error: String(err) };
  }
}

function renderEmailTemplate({
  titleFr,
  titleEn,
  contentFr,
  contentEn,
  actionUrl,
  actionTextFr,
  actionTextEn,
}: {
  titleFr: string;
  titleEn: string;
  contentFr: string;
  contentEn: string;
  actionUrl?: string;
  actionTextFr?: string;
  actionTextEn?: string;
}) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 580px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; }
    .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px; }
    .title { font-size: 18px; font-weight: 600; color: #f8fafc; margin-top: 12px; }
    .content { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #ef4444; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .divider { border-top: 1px dashed #334155; margin: 24px 0; }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">Première Services</div>
      <div class="title">${titleFr} / ${titleEn}</div>
    </div>
    
    <div class="content">
      <p><strong>Français :</strong></p>
      ${contentFr}
    </div>

    ${
      actionUrl && actionTextFr && actionTextEn
        ? `<div class="btn-container">
             <a href="${actionUrl}" class="btn">${actionTextFr} / ${actionTextEn}</a>
           </div>`
        : ""
    }

    <div class="divider"></div>

    <div class="content">
      <p><strong>English:</strong></p>
      ${contentEn}
    </div>

    <div class="footer">
      Première Services · Québec, Canada<br>
      Pour toute question : <a href="mailto:${FROM_EMAIL}" style="color: #38bdf8;">${FROM_EMAIL}</a>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || "");

  // ==========================================
  // ACTION: CONFIRM (Public link from email)
  // ==========================================
  if (action === "confirm") {
    const token = String(body.token || "").trim();
    if (!token) return json({ error: "Token required" }, 400);

    const { data: requestRow, error: fetchErr } = await adminClient
      .from("account_deletion_requests")
      .select("*")
      .eq("confirmation_token", token)
      .maybeSingle();

    if (fetchErr || !requestRow) {
      return json({ error: "Invalid or expired deletion token" }, 404);
    }

    if (requestRow.status === "cancelled") {
      return json({ error: "This deletion request was previously cancelled" }, 400);
    }

    if (requestRow.status === "processed" || requestRow.status === "completed") {
      return json({ error: "This account has already been processed for deletion" }, 400);
    }

    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledIso = scheduledDate.toISOString();

    const { error: updateErr } = await adminClient
      .from("account_deletion_requests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        scheduled_delete_at: scheduledIso,
      })
      .eq("id", requestRow.id);

    if (updateErr) {
      return json({ error: "Failed to update deletion status" }, 500);
    }

    // Get user email
    const { data: userData } = await adminClient.auth.admin.getUserById(requestRow.user_id);
    const userEmail = userData?.user?.email;

    if (userEmail) {
      const emailHtml = renderEmailTemplate({
        titleFr: "Suppression de compte confirmée",
        titleEn: "Account Deletion Confirmed",
        contentFr: `<p>Votre demande de suppression de compte a été confirmée avec succès.</p>
          <p>Conformément à la Loi 25 du Québec, toutes vos données personnelles, votre profil et vos fichiers associés seront <strong>définitivement supprimés dans 24 heures</strong> (le ${scheduledDate.toLocaleString("fr-CA")}).</p>
          <p>Si vous souhaitez annuler cette demande avant la fin du délai, connectez-vous à votre tableau de bord et cliquez sur « Annuler la demande de suppression ».</p>`,
        contentEn: `<p>Your account deletion request has been successfully confirmed.</p>
          <p>In accordance with Quebec's Law 25, all your personal data, profile, and associated files will be <strong>permanently deleted in 24 hours</strong> (on ${scheduledDate.toLocaleString("en-CA")}).</p>
          <p>If you wish to cancel this request before the deadline, log into your dashboard and click "Cancel deletion request".</p>`,
      });

      await sendResendEmail(
        userEmail,
        "Account deletion scheduled (24h) / Suppression programmée dans 24h",
        emailHtml
      );
    }

    return json({
      ok: true,
      message: "Account deletion confirmed and scheduled for permanent execution in 24 hours.",
      scheduled_delete_at: scheduledIso,
    });
  }

  // ==========================================
  // Authenticated Actions (require Bearer)
  // ==========================================
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Helper: check if caller is platform moderator / admin
  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  const isCallerAdmin = Boolean(adminProfile?.is_platform_admin);

  // ==========================================
  // ACTION: REQUEST DELETION
  // ==========================================
  if (action === "request") {
    const userEmail = user.email;
    if (!userEmail) return json({ error: "User has no email" }, 400);

    // Generate cryptographic token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledIso = scheduledDate.toISOString();

    // Check for existing pending request
    const { data: existing } = await adminClient
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["pending_confirmation", "pending", "confirmed"])
      .maybeSingle();

    if (existing?.id) {
      await adminClient
        .from("account_deletion_requests")
        .update({
          status: "pending_confirmation",
          confirmation_token: token,
          requested_at: new Date().toISOString(),
          scheduled_delete_at: scheduledIso,
          reason: String(body.reason || "user_dashboard_request"),
        })
        .eq("id", existing.id);
    } else {
      await adminClient.from("account_deletion_requests").insert({
        user_id: user.id,
        status: "pending_confirmation",
        confirmation_token: token,
        requested_at: new Date().toISOString(),
        scheduled_delete_at: scheduledIso,
        reason: String(body.reason || "user_dashboard_request"),
        retain_financial: true,
        retain_audit: true,
      });
    }

    const confirmUrl = `${SITE_URL}/confirm-deletion?token=${token}`;

    const emailHtml = renderEmailTemplate({
      titleFr: "Confirmation requise : suppression de votre compte",
      titleEn: "Confirmation required: delete your account",
      contentFr: `<p>Vous avez demandé la suppression définitive de votre compte Première Services et de vos données personnelles.</p>
        <p>Pour confirmer cette action, veuillez cliquer sur le bouton ci-dessous. Une fois confirmée, votre compte entrera dans une période de <strong>24 heures</strong>, après laquelle toutes vos données seront définitivement purgées.</p>
        <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer ce courriel et changer votre mot de passe sans délai.</p>`,
      contentEn: `<p>You have requested to permanently delete your Première Services account and personal data.</p>
        <p>To confirm this request, please click the button below. Once confirmed, your account will enter a <strong>24-hour grace period</strong>, after which all personal records and files will be permanently purged.</p>
        <p>If you did not request this, you can safely ignore this email and change your password immediately.</p>`,
      actionUrl: confirmUrl,
      actionTextFr: "Confirmer la suppression définitive",
      actionTextEn: "Confirm permanent deletion",
    });

    const sendRes = await sendResendEmail(
      userEmail,
      "Confirm account deletion / Confirmez la suppression de votre compte",
      emailHtml
    );

    return json({
      ok: true,
      message: "Confirmation email sent. Please check your inbox and click the confirmation link within 24 hours.",
      email: userEmail,
      emailSent: sendRes.ok,
    });
  }

  // ==========================================
  // ACTION: CANCEL DELETION
  // ==========================================
  if (action === "cancel") {
    const { error: cancelErr } = await adminClient
      .from("account_deletion_requests")
      .update({
        status: "cancelled",
        admin_notes: `Cancelled by user at ${new Date().toISOString()}`,
      })
      .eq("user_id", user.id)
      .in("status", ["pending_confirmation", "pending", "confirmed"]);

    if (cancelErr) return json({ error: "Failed to cancel deletion" }, 500);

    return json({ ok: true, message: "Account deletion request has been cancelled." });
  }

  // ==========================================
  // ACTION: STATUS
  // ==========================================
  if (action === "status") {
    const { data: currentRequest } = await adminClient
      .from("account_deletion_requests")
      .select("id, status, requested_at, confirmed_at, scheduled_delete_at")
      .eq("user_id", user.id)
      .in("status", ["pending_confirmation", "pending", "confirmed"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return json({ ok: true, request: currentRequest || null });
  }

  // ==========================================
  // ACTION: ADMIN LIST (Platform Admin Only)
  // ==========================================
  if (action === "admin_list") {
    if (!isCallerAdmin) return json({ error: "Forbidden" }, 403);

    const { data: list, error: listErr } = await adminClient
      .from("account_deletion_requests")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(100);

    if (listErr) return json({ error: listErr.message }, 500);

    return json({ ok: true, requests: list || [] });
  }

  // ==========================================
  // ACTION: EXECUTE PERMANENT PURGE
  // ==========================================
  if (action === "execute") {
    const targetUserId = String(body.user_id || (isCallerAdmin ? "" : user.id));
    if (!targetUserId) return json({ error: "user_id required" }, 400);

    // If caller is not admin, verify that the request is confirmed and 24h passed
    if (!isCallerAdmin) {
      if (targetUserId !== user.id) return json({ error: "Forbidden" }, 403);

      const { data: reqCheck } = await adminClient
        .from("account_deletion_requests")
        .select("status, scheduled_delete_at")
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .maybeSingle();

      if (!reqCheck) {
        return json({ error: "No confirmed deletion request found" }, 400);
      }

      if (reqCheck.scheduled_delete_at && new Date() < new Date(reqCheck.scheduled_delete_at)) {
        return json({
          error: "24-hour grace period has not elapsed yet",
          scheduled_delete_at: reqCheck.scheduled_delete_at,
        }, 400);
      }
    }

    console.log(`Executing permanent purge for user: ${targetUserId}`);

    // 1. Delete storage files
    const bucketsToClean = [
      "client-booking-verification",
      "pro-verification",
      "pro-photos",
    ];

    for (const b of bucketsToClean) {
      try {
        const { data: objects } = await adminClient.storage.from(b).list(targetUserId);
        if (objects && objects.length > 0) {
          const paths = objects.map((o) => `${targetUserId}/${o.name}`);
          await adminClient.storage.from(b).remove(paths);
        }
        // Also check /private subfolder if any
        const { data: privObjects } = await adminClient.storage.from(b).list(`${targetUserId}/private`);
        if (privObjects && privObjects.length > 0) {
          const privPaths = privObjects.map((o) => `${targetUserId}/private/${o.name}`);
          await adminClient.storage.from(b).remove(privPaths);
        }
      } catch (err) {
        console.warn(`Storage cleanup error for bucket ${b}:`, err);
      }
    }

    // 2. Mark request processed
    await adminClient
      .from("account_deletion_requests")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        admin_notes: `Purged by ${isCallerAdmin ? "admin " + user.id : "user execution"} at ${new Date().toISOString()}`,
      })
      .eq("user_id", targetUserId);

    // 3. Delete user from auth.users (cascades to all relational data)
    const { error: delErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (delErr) {
      console.error("Failed to delete user from auth.users:", delErr);
      return json({ error: "Failed to delete user: " + delErr.message }, 500);
    }

    return json({
      ok: true,
      message: "User account and all personal data permanently deleted.",
      purged_user_id: targetUserId,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
