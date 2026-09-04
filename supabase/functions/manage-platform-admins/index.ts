/**
 * Super-admin only: create / update / list / revoke platform admin staff accounts.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuperAdminEmail, normalizeEmail } from "../_shared/platformAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StaffPayload = {
  email?: string;
  password?: string;
  member_id?: string;
  full_name?: string;
  date_of_birth?: string | null;
  address?: string;
  phone?: string;
  phone_secondary?: string;
  best_contact_method?: string;
  additional_info?: string;
  user_id?: string;
  grant?: boolean;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMemberId(v: string) {
  return /^[0-9]{6}$/.test(v.trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user?.email || !isSuperAdminEmail(user.email)) {
    return json({ error: "Forbidden" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const body = (await req.json().catch(() => ({}))) as StaffPayload & { action?: string };
  const action = String(body.action ?? "list").trim();

  if (action === "list") {
    const { data: staff, error } = await admin
      .from("platform_admin_staff")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return json({ error: "Could not load staff" }, 500);
    return json({ ok: true, staff: staff ?? [] });
  }

  if (action === "create") {
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    const memberId = String(body.member_id ?? "").trim();
    if (!email.includes("@") || password.length < 8) {
      return json({ error: "Valid email and password (8+ chars) required" }, 400);
    }
    if (!isMemberId(memberId)) return json({ error: "Member ID must be exactly 6 digits" }, 400);

    const { data: existingMember } = await admin
      .from("profiles")
      .select("user_id")
      .eq("public_user_number", memberId)
      .maybeSingle();
    if (existingMember) return json({ error: "That member ID is already in use" }, 409);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: String(body.full_name ?? "").trim() },
    });
    if (createErr || !created.user) {
      return json({ error: "Could not create account" }, 400);
    }
    const uid = created.user.id;

    await admin.from("profiles").upsert(
      {
        user_id: uid,
        full_name: String(body.full_name ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        birthday: body.date_of_birth || null,
        address: String(body.address ?? "").trim(),
        is_platform_admin: true,
        public_user_number: memberId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );
    // Force assigned member ID (trigger may have allocated another).
    await admin.from("profiles").update({ public_user_number: memberId, is_platform_admin: true }).eq("user_id", uid);

    const { error: staffErr } = await admin.from("platform_admin_staff").upsert(
      {
        user_id: uid,
        email,
        member_id: memberId,
        full_name: String(body.full_name ?? "").trim(),
        date_of_birth: body.date_of_birth || null,
        address: String(body.address ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
        phone_secondary: String(body.phone_secondary ?? "").trim(),
        best_contact_method: String(body.best_contact_method ?? "").trim(),
        additional_info: String(body.additional_info ?? "").trim(),
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (staffErr) return json({ error: "Account created but staff profile failed" }, 500);

    const { data: actorProf } = await admin
      .from("profiles")
      .select("public_user_number")
      .eq("user_id", user.id)
      .maybeSingle();
    await admin.from("platform_admin_audit_events").insert({
      actor_user_id: user.id,
      actor_member_id: (actorProf as { public_user_number?: string } | null)?.public_user_number ?? null,
      action: "admin_staff_create",
      target_user_id: uid,
      target_member_id: memberId,
      detail: { email },
    });

    return json({ ok: true, user_id: uid, member_id: memberId });
  }

  if (action === "update") {
    const uid = String(body.user_id ?? "").trim();
    if (!uid) return json({ error: "Missing user_id" }, 400);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const key of [
      "full_name",
      "address",
      "phone",
      "phone_secondary",
      "best_contact_method",
      "additional_info",
      "email",
    ] as const) {
      if (typeof body[key] === "string") patch[key] = body[key];
    }
    if (body.date_of_birth !== undefined) patch.date_of_birth = body.date_of_birth || null;
    if (typeof body.member_id === "string" && isMemberId(body.member_id)) {
      patch.member_id = body.member_id.trim();
      await admin
        .from("profiles")
        .update({ public_user_number: body.member_id.trim() })
        .eq("user_id", uid);
    }
    const { error } = await admin.from("platform_admin_staff").update(patch).eq("user_id", uid);
    if (error) return json({ error: "Could not update staff" }, 500);
    return json({ ok: true });
  }

  if (action === "revoke") {
    const uid = String(body.user_id ?? "").trim();
    if (!uid) return json({ error: "Missing user_id" }, 400);
    if (uid === user.id) return json({ error: "Cannot revoke yourself" }, 400);
    const { data: actorProf } = await admin
      .from("profiles")
      .select("public_user_number")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: targetStaff } = await admin
      .from("platform_admin_staff")
      .select("member_id")
      .eq("user_id", uid)
      .maybeSingle();
    await admin.from("profiles").update({ is_platform_admin: false }).eq("user_id", uid);
    await admin.from("platform_admin_staff").delete().eq("user_id", uid);
    await admin.from("platform_admin_audit_events").insert({
      actor_user_id: user.id,
      actor_member_id: (actorProf as { public_user_number?: string } | null)?.public_user_number ?? null,
      action: "admin_staff_revoke",
      target_user_id: uid,
      target_member_id: (targetStaff as { member_id?: string } | null)?.member_id ?? null,
      detail: {},
    });
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
