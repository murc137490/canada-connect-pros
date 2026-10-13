import { createClient } from "npm:@supabase/supabase-js@2.97.0";

const allowedOrigins = new Set([
  "https://altshift.ca",
  "https://www.altshift.ca",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const corsOrigin = allowedOrigins.has(origin) ? origin : "null";
  const headers = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300",
    "X-Content-Type-Options": "nosniff",
  };

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }
  if (!allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), { status: 403, headers });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing required Supabase server environment configuration");
    return new Response(JSON.stringify({ error: "Count temporarily unavailable" }), { status: 503, headers });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { count, error } = await admin.from("profiles").select("user_id", { count: "exact", head: true });
  if (error || count === null) {
    console.error("Unable to count registered member profiles", error?.message);
    return new Response(JSON.stringify({ error: "Count temporarily unavailable" }), { status: 503, headers });
  }

  return new Response(JSON.stringify({ count }), { status: 200, headers });
});
