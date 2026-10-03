import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.altshift.ca",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESOURCE_ID = "32f6ec46-85fd-45e9-945b-965d9235840a";
const DATASET_URL = "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search";
type Row = Record<string, unknown>;

function normalized(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = /^https:\/\/(www\.)?altshift\.ca$/.test(origin) || /^http:\/\/localhost:\d+$/.test(origin)
    ? origin
    : "https://www.altshift.ca";
  corsHeaders["Access-Control-Allow-Origin"] = allowedOrigin;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceKey) return response({ error: "Unauthorized" }, 401);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Unauthorized" }, 401);

  let body: { license_number?: string; legal_name?: string; pro_profile_id?: string };
  try { body = await req.json(); } catch { return response({ error: "Invalid JSON" }, 400); }
  const licenseNumber = String(body.license_number ?? "").trim();
  const legalName = String(body.legal_name ?? "").trim();
  if (!/^\d{4}-\d{4}-\d{2}$/.test(licenseNumber)) return response({ error: "Enter a licence number in 1234-5678-90 format." }, 400);
  if (legalName.length < 2 || legalName.length > 200) return response({ error: "Enter the legal holder or business name." }, 400);

  let profileId: string | undefined;
  if (body.pro_profile_id) {
    profileId = String(body.pro_profile_id);
    const { data: ownProfile, error } = await userClient.from("pro_profiles").select("id").eq("id", profileId).eq("user_id", authData.user.id).maybeSingle();
    if (error || !ownProfile) return response({ error: "That professional profile is not associated with your account." }, 403);
  }

  const persistResult = async (result: Record<string, unknown>) => {
    if (!profileId) return null;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing, error: findError } = await admin.from("pro_licenses").select("id").eq("pro_profile_id", profileId).eq("license_number", licenseNumber).maybeSingle();
    if (findError) return findError;
    const verified = result.status === "verified";
    const licenseRow = {
      pro_profile_id: profileId,
      license_number: licenseNumber,
      license_type: "RBQ",
      holder_name: String(result.official_name ?? legalName),
      is_verified: verified,
      verification_data: result,
      verified_at: verified ? new Date().toISOString() : null,
    };
    const write = existing
      ? await admin.from("pro_licenses").update(licenseRow).eq("id", existing.id)
      : await admin.from("pro_licenses").insert(licenseRow);
    return write.error;
  };

  let records: Row[];
  try {
    const endpoint = new URL(DATASET_URL);
    endpoint.searchParams.set("resource_id", RESOURCE_ID);
    endpoint.searchParams.set("limit", "100");
    endpoint.searchParams.set("filters", JSON.stringify({ "Numero de licence": licenseNumber }));
    const upstream = await fetch(endpoint, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!upstream.ok) throw new Error(`Dataset responded ${upstream.status}`);
    const payload = await upstream.json();
    if (!payload.success) throw new Error("Dataset query failed");
    records = payload.result.records as Row[];
  } catch (error) {
    console.error("RBQ dataset unavailable", error);
    const result = { status: "needs_review", reason: "registry_unavailable", license_number: licenseNumber, source: "Données Québec — RBQ active licence dataset", checked_at: new Date().toISOString() };
    if (await persistResult(result)) return response({ error: "Unable to save registry result." }, 500);
    return response(result);
  }

  if (records.length === 0) {
    const result = { status: "needs_review", reason: "not_found_in_active_dataset", license_number: licenseNumber, source: "Données Québec — RBQ active licence dataset", checked_at: new Date().toISOString() };
    if (await persistResult(result)) return response({ error: "Unable to save registry result." }, 500);
    return response(result);
  }
  const row = records[0];
  const officialName = String(row["Nom de l'intervenant"] ?? "").trim();
  const aliases = [...new Set(records.map((r) => String(r["Autre nom"] ?? "").trim()).filter(Boolean))];
  const nameMatches = [officialName, ...aliases].some((name) => normalized(name) === normalized(legalName));
  const subcategories = [...new Set(records.map((r) => String(r["Sous-categories"] ?? "").trim()).filter(Boolean))].sort();
  const active = records.some((r) => normalized(r["Statut de la licence"]) === "active");
  const entrepreneur = records.some((r) => normalized(r["Type de licence"]) === "entrepreneur");
  const unrestricted = records.every((r) => normalized(r["Restriction"]) === "non");
  const verified = active && entrepreneur && unrestricted && nameMatches && subcategories.length > 0;
  const result = {
    status: verified ? "verified" : "needs_review",
    license_number: licenseNumber,
    official_name: officialName,
    aliases,
    license_type: String(row["Type de licence"] ?? ""),
    license_status: active ? "Active" : String(row["Statut de la licence"] ?? "Unknown"),
    restriction: unrestricted ? "None" : "Restricted or unclear",
    subcategories,
    name_matches: nameMatches,
    reason: verified ? null : !active ? "not_active" : !entrepreneur ? "not_an_entrepreneur_licence" : !unrestricted ? "restricted_or_unclear" : !nameMatches ? "holder_name_mismatch" : "missing_authorizations",
    source: "Données Québec — RBQ active licence dataset",
    dataset_resource_id: RESOURCE_ID,
    checked_at: new Date().toISOString(),
  };

  if (await persistResult(result)) return response({ error: "Unable to save registry result." }, 500);

  return response(result);
});
