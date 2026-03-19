# Copy-paste: SQL and Edge Functions

Run **SQL** in **Supabase Dashboard → SQL Editor → New query** (in the order below).  
Create each **Edge Function** in **Supabase Dashboard → Edge Functions → Create function**, paste the code, then set the listed **Secrets**.

---

## Part 1 — SQL (run in this order)

### 1.1 Base tables (run first)

Paste the contents of **`supabase/RUN-THIS-ONCE-CREATE-TABLES.sql`** into the SQL Editor and run it. That file creates: `profiles`, `pro_profiles`, `pro_services`, `pro_photos`, `pro_licenses`, `reviews`, `review_photos`, `review_responses`, storage buckets, and triggers.

(If you prefer a single block here, open `RUN-THIS-ONCE-CREATE-TABLES.sql` in your project and copy its full content.)

### 1.2 Bookings + top picks

```sql
-- Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_pro_profile ON public.bookings(pro_profile_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(pro_profile_id, status);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bookings count" ON public.bookings;
CREATE POLICY "Anyone can view bookings" ON public.bookings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated can create booking" ON public.bookings;
CREATE POLICY "Authenticated can create booking" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = client_id);
DROP POLICY IF EXISTS "Pro can update own booking" ON public.bookings;
CREATE POLICY "Pro can update own booking" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.get_top_picks(p_category_slug text)
RETURNS TABLE(
  pro_profile_id uuid,
  business_name text,
  avg_rating numeric,
  review_count bigint,
  booking_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pro_rating AS (
    SELECT pp.id, pp.business_name,
           (SELECT COALESCE(AVG(r.rating), 0)::numeric(3,2) FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS avg_rating,
           (SELECT COUNT(*)::bigint FROM public.reviews r WHERE r.pro_profile_id = pp.id) AS review_count,
           (SELECT COUNT(*)::bigint FROM public.bookings b WHERE b.pro_profile_id = pp.id AND b.status = 'completed') AS booking_count
    FROM public.pro_profiles pp
    WHERE pp.is_verified = true
      AND EXISTS (SELECT 1 FROM public.pro_services ps WHERE ps.pro_profile_id = pp.id AND ps.category_slug = p_category_slug)
  )
  SELECT pr.id, pr.business_name, pr.avg_rating, pr.review_count, pr.booking_count
  FROM pro_rating pr
  WHERE (pr.booking_count >= 50 OR pr.review_count >= 40)
  ORDER BY pr.avg_rating DESC NULLS LAST, pr.review_count DESC
  LIMIT 3;
$$;
```

### 1.3 Decline booking + client reviews

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS decline_reason text;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled', 'declined'));

CREATE TABLE IF NOT EXISTS public.client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pro_profile_id uuid NOT NULL REFERENCES public.pro_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pro_profile_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_reviews_client ON public.client_reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_pro ON public.client_reviews(pro_profile_id);

ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pros can insert client review" ON public.client_reviews;
CREATE POLICY "Pros can insert client review" ON public.client_reviews FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Pros can update own client review" ON public.client_reviews;
CREATE POLICY "Pros can update own client review" ON public.client_reviews FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.pro_profiles pp WHERE pp.id = pro_profile_id AND pp.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Anyone can read client reviews" ON public.client_reviews;
CREATE POLICY "Anyone can read client reviews" ON public.client_reviews FOR SELECT USING (true);
```

---

## Part 2 — Edge Functions (paste code, then set secrets)

### 2.1 `square-create-payment`

**Dashboard:** Edge Functions → Create function → name: **square-create-payment** → paste the code below → Deploy.

**Secrets:** `SQUARE_ACCESS_TOKEN` (required); optionally `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT` (`sandbox` or `production`). See **docs/SQUARE-SETUP.md**.

```typescript
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const accessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
  const locationId = Deno.env.get("SQUARE_LOCATION_ID");
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Square not configured", details: "SQUARE_ACCESS_TOKEN missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceId = typeof body.source_id === "string" ? body.source_id.trim() : null;
    const amountCents = Math.round(Number(body.amount_cents) || 0);
    const currency = (body.currency ?? "cad").toString().toUpperCase().slice(0, 3);
    const proProfileId = body.pro_profile_id ?? null;
    const clientId = body.client_id ?? null;

    if (!sourceId) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: "source_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Invalid amount", details: "Minimum 50 cents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const idempotencyKey = body.idempotency_key ?? `booking-${proProfileId ?? "x"}-${clientId ?? "y"}-${Date.now()}`;

    const squareBody: Record<string, unknown> = {
      source_id: sourceId,
      idempotency_key: idempotencyKey.slice(0, 45),
      amount_money: {
        amount: amountCents,
        currency,
      },
      autocomplete: true,
    };
    if (locationId) squareBody.location_id = locationId;
    if (proProfileId) squareBody.reference_id = proProfileId.slice(0, 40);

    const useSandbox = Deno.env.get("SQUARE_ENVIRONMENT") !== "production";
    const squareBase = useSandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const squareRes = await fetch(`${squareBase}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Square-Version": "2024-01-18",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(squareBody),
    });

    const data = await squareRes.json().catch(() => ({}));

    if (!squareRes.ok) {
      const errMsg = data.errors?.[0]?.detail ?? data.errors?.[0]?.code ?? data.message ?? "Square error";
      return new Response(
        JSON.stringify({ error: "Payment failed", details: errMsg }),
        { status: squareRes.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ payment_id: data.payment?.id, status: data.payment?.status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

### 2.2 `twilio-verify`

**Dashboard:** Edge Functions → Create function → name: **twilio-verify** → paste the code below → Deploy.

**Secrets:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. See **docs/TWILIO-VERIFY-SETUP.md**.

**Body examples:**  
Send: `{ "action": "send", "to": "+14505784500", "channel": "sms" }`  
Check: `{ "action": "check", "to": "+14505784500", "code": "4977" }`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TWILIO_VERIFY_BASE = "https://verify.twilio.com/v2";

function basicAuth(accountSid: string, authToken: string): string {
  return btoa(`${accountSid}:${authToken}`);
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

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const serviceSid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

  if (!accountSid || !authToken || !serviceSid) {
    return new Response(
      JSON.stringify({
        error: "Twilio Verify not configured",
        details: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID in Edge Function secrets.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const auth = basicAuth(accountSid, authToken);
  const url = `${TWILIO_VERIFY_BASE}/Services/${serviceSid}`;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "check" ? "check" : "send";

    if (action === "send") {
      const to = typeof body.to === "string" ? body.to.trim() : "";
      const channel = (body.channel ?? "sms").toString().toLowerCase();
      if (!to) {
        return new Response(
          JSON.stringify({ error: "Missing 'to' (e.g. +14505784500)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const form = new URLSearchParams();
      form.set("To", to);
      form.set("Channel", channel === "sms" || channel === "call" ? channel : "sms");

      const res = await fetch(`${url}/Verifications`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: data.message ?? "Failed to send verification",
            code: data.code,
          }),
          { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ status: data.status, sid: data.sid, valid: data.valid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = typeof body.to === "string" ? body.to.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!to || !code) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or 'code'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const form = new URLSearchParams();
    form.set("To", to);
    form.set("Code", code);

    const res = await fetch(`${url}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: data.message ?? "Verification check failed",
          code: data.code,
        }),
        { status: res.status >= 500 ? 502 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ status: data.status, valid: data.valid === true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

### 2.3 `accept-pro`

**Dashboard:** Edge Functions → Create function → name: **accept-pro** → paste the code below → Deploy.

**Secrets:** Uses built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (usually set by Supabase). No extra secrets. Only user with email **premiereservicescontact@gmail.com** can call it.

**Body:** `{ "pro_user_id": "<uuid of the pro's auth.users id>" }`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const email = (user.email ?? "").toLowerCase();
    if (email !== "premiereservicescontact@gmail.com") {
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

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { error } = await adminClient
      .from("pro_profiles")
      .update({ is_verified: true, updated_at: new Date().toISOString() })
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
```

---

## Summary

| Item | Where |
|------|--------|
| **SQL 1.1** | Open `supabase/RUN-THIS-ONCE-CREATE-TABLES.sql` and paste its full content into SQL Editor → Run. |
| **SQL 1.2** | Bookings + top picks (block above). |
| **SQL 1.3** | Decline + client_reviews (block above). |
| **square-create-payment** | Edge Function; secrets: `SQUARE_ACCESS_TOKEN`, optional `SQUARE_LOCATION_ID`, `SQUARE_ENVIRONMENT`. |
| **twilio-verify** | Edge Function; secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. |
| **accept-pro** | Edge Function; no extra secrets. |
