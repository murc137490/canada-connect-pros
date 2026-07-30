// Only admins (listed in admin_users) can accept a pro. Uses service role to set is_verified.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// PLATFORM_ADMIN_EMAILS secret helpers (inlined for Supabase Dashboard)
function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}
function parsePlatformAdminEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((e) => normalizeEmail(e)).filter(Boolean))];
}
function getPlatformAdminEmails(): string[] {
  return parsePlatformAdminEmailList(Deno.env.get("PLATFORM_ADMIN_EMAILS"));
}
function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const em = normalizeEmail(email);
  return em.length > 0 && getPlatformAdminEmails().includes(em);
}
async function callerIsPlatformModerator(
  adminClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  userId: string,
  email: string | undefined,
): Promise<boolean> {
  if (isPlatformAdminEmail(email)) return true;
  const { data } = await adminClient.from("profiles").select("is_platform_admin").eq("user_id", userId).maybeSingle();
  return (data as { is_platform_admin?: boolean } | null)?.is_platform_admin === true;
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


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

    return new Response(JSON.stringify({ ok: true }), {
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
