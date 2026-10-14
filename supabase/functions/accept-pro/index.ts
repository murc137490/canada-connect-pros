// Only admins (listed in admin_users) can accept a pro. Uses service role to set is_verified.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

import { callerIsPlatformModerator } from "../_shared/platformAdmin.ts";
import { withCorsAllowlist } from "../_shared/cors.ts";
import { sendBrandEmail } from "../_shared/sendBrandEmail.ts";

Deno.serve(withCorsAllowlist(async (req) => {
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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    if (!(await callerIsPlatformModerator(adminClient, user.id, user.email))) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const proUserId = typeof body.pro_user_id === "string" ? body.pro_user_id.trim() : null;
    if (!proUserId) {
      return new Response(JSON.stringify({ error: "Missing pro_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("pro_profiles")
      .select("business_name, is_verified")
      .eq("user_id", proUserId)
      .maybeSingle();
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: profileError?.message ?? "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.is_verified) {
      return new Response(JSON.stringify({ error: "Application is already approved" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await adminClient
      .from("pro_profiles")
      .update({
        is_verified: true,
        updated_at: new Date().toISOString(),
        approval_baseline_json: null,
        profile_last_edited_at: null,
      })
      .eq("user_id", proUserId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: noticeError } = await adminClient.from("pro_application_review_notices").insert({
      user_id: proUserId,
      decision: "approved",
    });
    if (noticeError) console.error("Could not save pro approval notice", noticeError.message);

    let emailSent = false;
    const { data: authUser } = await adminClient.auth.admin.getUserById(proUserId);
    const toEmail = authUser.user?.email;
    if (toEmail) {
      const businessName = escapeHtml(profile.business_name ?? "AltShift");
      const href = "https://www.altshift.ca/dashboard?tab=account";
      const html = `<p>Good news, your professional application for <strong>${businessName}</strong> has been approved. You are now a pro on AltShift.</p><p>Bonne nouvelle, votre demande de compte professionnel pour <strong>${businessName}</strong> a été approuvée. Vous êtes maintenant pro sur AltShift.</p><p><a href="${href}">Open your account / Ouvrir votre compte</a></p>`;
      emailSent = await sendBrandEmail(toEmail, "AltShift | Pro application approved / Demande pro approuvée", html);
    }

    return new Response(JSON.stringify({ ok: true, email_sent: emailSent, notice_saved: !noticeError }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}));

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, (char) => entities[char] ?? char);
}
