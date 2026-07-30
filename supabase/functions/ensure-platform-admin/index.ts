/**
 * Syncs PLATFORM_ADMIN_EMAILS secret → DB config + profiles.is_platform_admin.
 * Call after sign-in (AuthContext).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPlatformAdminEmails, isPlatformAdminEmail, normalizeEmail } from "../_shared/platformAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_USER_PAGES = 20;
const USERS_PER_PAGE = 200;

async function loadAuthUserMaps(admin: ReturnType<typeof createClient>): Promise<{
  emailById: Map<string, string>;
  idByEmail: Map<string, string>;
}> {
  const emailById = new Map<string, string>();
  const idByEmail = new Map<string, string>();
  let page = 1;

  while (page <= MAX_USER_PAGES) {
    const { data: listed } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    for (const u of listed?.users ?? []) {
      if (!u.id || !u.email) continue;
      const em = normalizeEmail(u.email);
      emailById.set(u.id, em);
      idByEmail.set(em, u.id);
    }
    if (!listed?.users?.length || listed.users.length < USERS_PER_PAGE) break;
    page += 1;
  }

  return { emailById, idByEmail };
}

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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminEmails = getPlatformAdminEmails();
  const adminSet = new Set(adminEmails);
  const admin = createClient(supabaseUrl, serviceKey);
  const now = new Date().toISOString();

  await admin.from("platform_admin_config").upsert(
    { key: "admin_emails", value: adminEmails.join(","), updated_at: now },
    { onConflict: "key" },
  );

  let profilesSynced = false;

  // Do not revoke everyone if the secret is missing or empty (misconfiguration guard).
  if (adminSet.size > 0) {
    const { emailById, idByEmail } = await loadAuthUserMaps(admin);

    const { data: flaggedProfiles } = await admin
      .from("profiles")
      .select("user_id")
      .eq("is_platform_admin", true);

    for (const row of flaggedProfiles ?? []) {
      const uid = (row as { user_id: string }).user_id;
      const em = emailById.get(uid) ?? "";
      if (!adminSet.has(em)) {
        await admin.from("profiles").update({ is_platform_admin: false }).eq("user_id", uid);
      }
    }

    for (const em of adminSet) {
      const uid = idByEmail.get(em);
      if (!uid) continue;
      await admin.from("profiles").update({ is_platform_admin: true }).eq("user_id", uid);
    }

    profilesSynced = true;
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("is_platform_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  const isModerator =
    isPlatformAdminEmail(user.email) ||
    (prof as { is_platform_admin?: boolean } | null)?.is_platform_admin === true;

  return new Response(
    JSON.stringify({
      ok: true,
      is_platform_moderator: isModerator,
      profiles_synced: profilesSynced,
      admin_email_count: adminSet.size,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
