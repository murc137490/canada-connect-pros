// Admin-only: decline a pro application, set application_declined_at, and optionally email the applicant.
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
const FROM_EMAIL = Deno.env.get("DECLINE_PRO_FROM_EMAIL") ?? Deno.env.get("FROM_EMAIL") ?? "notifications@premiereservices.ca";
const FROM_NAME = Deno.env.get("FROM_NAME") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = (user.email ?? "").toLowerCase();
    if (email !== "premiereservicescontact@gmail.com") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const proUserId = typeof body.pro_user_id === "string" ? body.pro_user_id.trim() : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!proUserId) {
      return new Response(JSON.stringify({ error: "Missing pro_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: proProfile } = await adminClient
      .from("pro_profiles")
      .select("business_name")
      .eq("user_id", proUserId)
      .single();

    const { error: updateError } = await adminClient
      .from("pro_profiles")
      .update({
        application_declined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", proUserId);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailSent = false;
    const { data: authUser } = await adminClient.auth.admin.getUserById(proUserId);
    const toEmail = authUser?.user?.email;
    if (toEmail) {
      const businessName = proProfile?.business_name ?? "Your application";
      const subject = "Premiere Services – Pro application update";
      const html = `<p>Your pro application for <strong>${escapeHtml(businessName)}</strong> was not accepted at this time.</p>${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}<p>You can contact us if you have questions.</p>`;
      if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
        emailSent = await sendEmailViaSmtp({ SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, FROM_NAME }, toEmail, subject, html);
      } else if (RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM_EMAIL, to: [toEmail], subject, html }),
        });
        emailSent = res.ok;
      }
    }

    return new Response(JSON.stringify({ ok: true, email_sent: emailSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmailViaSmtp(
  env: { SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASS?: string; FROM_EMAIL?: string; FROM_NAME?: string },
  to: string,
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
    await client.send({ from, to, subject, content: " ", html });
    client.close();
    return true;
  } catch {
    return false;
  }
}
