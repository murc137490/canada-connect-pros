import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SMTP_HOST = Deno.env.get("SMTP_HOST");
const SMTP_PORT = Deno.env.get("SMTP_PORT");
const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");

const FROM_EMAIL = Deno.env.get("CLAIM_FROM_EMAIL") ?? Deno.env.get("FROM_EMAIL") ?? "noreply@example.com";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "";

const SUPPORT_EMAIL = "support@premiereservices.ca";

const MAX_ATTACHMENTS = 10;

const ALLOWED_CLAIM_TYPES = ["issue", "refund", "redo", "payment_problem", "service_problem", "cancellation"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeAttachmentUrls(raw: unknown, bookingId: string): string[] {
  if (!Array.isArray(raw)) return [];
  const urls = raw.filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean);
  const safe = urls.filter((u) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === "https:" && u.includes(bookingId);
    } catch {
      return false;
    }
  });
  return safe.slice(0, MAX_ATTACHMENTS);
}

async function sendEmailViaSmtp(
  env: { SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASS?: string; FROM_EMAIL?: string; FROM_NAME?: string },
  to: string[],
  subject: string,
  html: string
): Promise<boolean> {
  const host = env.SMTP_HOST?.trim();
  if (!host || !env.SMTP_USER || !env.SMTP_PASS) return false;
  const port = parseInt(env.SMTP_PORT || "587", 10);

  const fromEmail = (env.FROM_EMAIL || "noreply@example.com").trim();
  const from = env.FROM_NAME?.trim() ? `${env.FROM_NAME.trim()} <${fromEmail}>` : fromEmail;

  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: env.SMTP_USER!, password: env.SMTP_PASS! },
      },
      debug: { log: false, allowUnsecure: port === 587 },
    });

    for (const recipient of to) {
      await client.send({ from, to: recipient, subject, content: " ", html });
    }
    client.close();
    return true;
  } catch {
    return false;
  }
}

async function sendWithResend(to: string[], subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const bookingId = typeof body.booking_id === "string" ? body.booking_id.trim() : null;
    const claimId = typeof body.claim_id === "string" ? body.claim_id.trim() : null;
    const claimType = typeof body.claim_type === "string" ? body.claim_type.trim() : null;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Missing booking_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!claimId) {
      return new Response(JSON.stringify({ error: "Missing claim_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!claimType || !ALLOWED_CLAIM_TYPES.includes(claimType)) {
      return new Response(JSON.stringify({ error: "Invalid claim_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (message.length < 5) {
      return new Response(JSON.stringify({ error: "Message is too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachment_urls = normalizeAttachmentUrls(body.attachment_urls, bookingId);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: claimRow, error: claimErr } = await adminClient
      .from("booking_claim_requests")
      .select("id, booking_id, client_id, issue_number, claim_type")
      .eq("id", claimId)
      .maybeSingle();

    if (claimErr || !claimRow) {
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claimRow.booking_id !== bookingId || claimRow.client_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const issueNumber =
      typeof claimRow.issue_number === "number"
        ? claimRow.issue_number
        : Number.parseInt(String(claimRow.issue_number ?? ""), 10);

    const { data: booking } = await adminClient
      .from("bookings")
      .select("id, client_id, pro_profile_id, preferred_date, created_at, status")
      .eq("id", bookingId)
      .single();

    if (!booking || booking.client_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pro } = await adminClient.from("pro_profiles").select("business_name").eq("id", booking.pro_profile_id).single();

    const businessName = pro?.business_name ?? "Service provider";

    const { data: authUser } = await adminClient.auth.admin.getUserById(booking.client_id);
    const clientEmail = (authUser?.user?.email ?? "").trim();

    const attachmentsHtml =
      attachment_urls.length === 0
        ? ""
        : `<p><strong>Attachments (${attachment_urls.length}):</strong></p><ul>${attachment_urls.map((u) => `<li><a href="${escapeHtml(u)}">${escapeHtml(u)}</a></li>`).join("")}</ul>`;

    const typeLabel =
      claimType === "issue"
        ? "Issue report"
        : claimType === "refund"
          ? "Refund request"
          : claimType === "redo"
            ? "Redo request"
            : claimType === "payment_problem"
              ? "Payment problem"
              : claimType === "service_problem"
                ? "Service problem"
                : claimType === "cancellation"
                  ? "Cancellation / schedule"
                  : "Booking report";

    const issueLabel = Number.isFinite(issueNumber) ? String(issueNumber) : claimId.slice(0, 8).toUpperCase();

    const supportSubject =
      claimType === "issue" || claimType === "payment_problem" || claimType === "service_problem" || claimType === "cancellation"
        ? `Premiere Services – Issue #${issueLabel} (booking #${bookingId})`
        : `Premiere Services – Claim (${claimType}) #${bookingId}`;

    const supportHtml = `
      <h2 style="margin:0 0 12px 0;">${escapeHtml(typeLabel)}</h2>
      <p><strong>Issue number:</strong> ${escapeHtml(issueLabel)}</p>
      <p><strong>Claim ID:</strong> ${escapeHtml(claimId)}</p>
      <p><strong>Booking ID:</strong> ${escapeHtml(bookingId)}</p>
      <p><strong>Service provider:</strong> ${escapeHtml(businessName)}</p>
      <p><strong>Report type:</strong> ${escapeHtml(claimType)}</p>
      <p><strong>Client email:</strong> ${escapeHtml(clientEmail)}</p>
      <p><strong>Appointment date:</strong> ${escapeHtml(String(booking.preferred_date ?? booking.created_at ?? ""))}</p>
      <hr />
      <p><strong>Details:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      ${attachmentsHtml}
      <p style="color:#666; font-size:12px;">Submitted from Premiere Services.</p>
    `;

    let supportSent = false;
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      supportSent = await sendEmailViaSmtp(
        { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME },
        [SUPPORT_EMAIL],
        supportSubject,
        supportHtml
      );
    } else if (RESEND_API_KEY) {
      supportSent = await sendWithResend([SUPPORT_EMAIL], supportSubject, supportHtml);
    }

    let clientSent = false;
    if (clientEmail) {
      const clientSubject = `We received your report — Issue #${issueLabel}`;
      const clientHtml = `
        <h2 style="margin:0 0 12px 0;">Thank you for contacting Premiere Services</h2>
        <p>Your report was received and logged.</p>
        <p><strong>Your issue number:</strong> ${escapeHtml(issueLabel)}</p>
        <p>Please keep this number for your records. Our team will review your case and follow up as needed.</p>
        <p style="color:#666; font-size:12px;">Booking reference: ${escapeHtml(bookingId)}</p>
      `;
      if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        clientSent = await sendEmailViaSmtp(
          { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME },
          [clientEmail],
          clientSubject,
          clientHtml
        );
      } else if (RESEND_API_KEY) {
        clientSent = await sendWithResend([clientEmail], clientSubject, clientHtml);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        issue_number: issueLabel,
        email_sent_support: supportSent,
        email_sent_client: clientSent,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
