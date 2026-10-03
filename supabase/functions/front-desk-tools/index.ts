/**
 * Front Desk tool executor — private application logic for GPT-Live / Realtime.
 * Auth: x-front-desk-secret OR authenticated user JWT for web demo.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { toE164NorthAmerica } from "./phoneE164.ts";
import { callerProFields, findProByPhone, handleProTool } from "./proJobs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-front-desk-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE = (Deno.env.get("SITE_URL") || "https://www.altshift.ca").replace(/\/$/, "");
const TERMS_VERSION = "2026-09";
const TERMS_HASH = "client-booking-2026-09";

const DEMO_CATALOG: { slug: string; en: string; fr: string; category: string; price_cad: number }[] = [
  { slug: "lawn-care", en: "Lawn Care", fr: "Entretien de pelouse", category: "Outdoor & Seasonal", price_cad: 89 },
  { slug: "leaf-cleanup", en: "Leaf Cleanup", fr: "Ramassage de feuilles", category: "Outdoor & Seasonal", price_cad: 120 },
  { slug: "house-cleaning", en: "House Cleaning", fr: "Ménage résidentiel", category: "Cleaning", price_cad: 150 },
  { slug: "snow-removal", en: "Snow Removal", fr: "Déneigement", category: "Outdoor & Seasonal", price_cad: 95 },
];

type SessionRow = {
  id: string;
  channel: "web" | "phone" | "demo";
  authenticated: boolean;
  customer_user_id: string | null;
  customer_member_id: string | null;
  draft: Record<string, unknown>;
  flow: string | null;
  language: string;
  otp_sent_at: string | null;
  otp_verified_at: string | null;
  closed_at: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMemberId(raw: string): string {
  return raw.replace(/\D/g, "");
}

function normalizeBookingCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function loadSession(admin: SupabaseClient, sessionId: string): Promise<SessionRow | null> {
  const { data } = await admin
    .from("front_desk_sessions")
    .select("id, channel, authenticated, customer_user_id, customer_member_id, draft, flow, language, otp_sent_at, otp_verified_at, closed_at")
    .eq("id", sessionId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

async function patchSession(admin: SupabaseClient, id: string, patch: Record<string, unknown>) {
  await admin
    .from("front_desk_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

async function sendOtp(phoneE164: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/telnyx-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ action: "send", to: phoneE164, channel: "sms" }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t.slice(0, 200) };
  }
  return { ok: true };
}

async function checkOtp(phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const res = await fetch(`${supabaseUrl}/functions/v1/telnyx-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ action: "check", to: phoneE164, code }),
  });
  const payload = await res.json().catch(() => ({})) as { valid?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: payload.error ?? `Telnyx Verify returned HTTP ${res.status}` };
  // A rejected Telnyx OTP check can be HTTP 200; require the explicit verdict.
  return payload.valid === true
    ? { ok: true }
    : { ok: false, error: payload.error ?? "Verification code was not accepted" };
}

function searchCatalog(query: string) {
  const q = query.toLowerCase();
  const hits = DEMO_CATALOG.filter(
    (s) =>
      s.en.toLowerCase().includes(q) ||
      s.fr.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.slug.includes(q.replace(/\s+/g, "-")) ||
      (q.includes("lawn") && s.slug === "lawn-care") ||
      (q.includes("leaf") && s.slug === "leaf-cleanup") ||
      (q.includes("mow") && s.slug === "lawn-care") ||
      ((q.includes("clean") || q.includes("ménage") || q.includes("menage")) && s.slug === "house-cleaning") ||
      (q.includes("snow") && s.slug === "snow-removal"),
  );
  return hits.length ? hits : DEMO_CATALOG.slice(0, 3);
}

async function executeTool(
  admin: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const sessionId = String(args.session_id ?? "");
  if (!sessionId) return { error: "missing_session_id" };

  const session = await loadSession(admin, sessionId);
  if (!session) return { error: "session_not_found" };
  if (session.closed_at) return { error: "session_closed" };

  const requireAuth = () => {
    if (!session.authenticated || !session.customer_user_id) {
      return { error: "not_authenticated", message: "Authenticate with Member ID + OTP first." };
    }
    return null;
  };

  switch (name) {
    case "set_session_language": {
      const requested = String(args.language ?? "").toLowerCase();
      const language = ["en", "fr", "es", "ar"].includes(requested) ? requested : "fr";
      await patchSession(admin, sessionId, { language });
      return { ok: true, language };
    }

    case "identify_caller": {
      const rawPhone = String(session.draft?.caller_phone_e164 ?? session.draft?.phone ?? "");
      const phone = toE164NorthAmerica(rawPhone) ?? (rawPhone.startsWith("+") ? rawPhone : null);
      if (!phone) return { ok: false, matched: false, reason: "no_caller_phone" };
      const e164Digits = phone.replace(/\D/g, "");
      const last10 = e164Digits.slice(-10);
      const { data: profiles } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, public_user_number, voice_pin_hash")
        .not("phone", "is", null)
        .limit(500);
      const phoneHits = (profiles ?? []).filter((p) => {
        const pDigits = String(p.phone ?? "").replace(/\D/g, "");
        return pDigits === e164Digits || pDigits.slice(-10) === last10;
      });
      if (phoneHits.length > 1) return { ok: true, matched: false, ambiguous: true, caller_phone: phone, reason: "phone_matches_multiple_accounts" };
      let hit = phoneHits[0];
      if (!hit) {
        const proOnly = await findProByPhone(admin, phone);
        if (!proOnly) return { ok: true, matched: false, caller_phone: phone, is_pro: false };
        const { data: proProfile } = await admin
          .from("profiles")
          .select("user_id, full_name, phone, public_user_number, voice_pin_hash")
          .eq("user_id", proOnly.user_id)
          .maybeSingle();
        if (!proProfile) {
          await patchSession(admin, sessionId, {
            draft: {
              ...session.draft,
              caller_guess_user_id: proOnly.user_id,
              caller_phone_e164: phone,
              pro_profile_id: proOnly.id,
            },
          });
          return {
            ok: true,
            matched: true,
            is_pro: true,
            has_pin: false,
            business_name: proOnly.business_name,
            pro_member_id: proOnly.pro_member_id,
            caller_phone: phone,
          };
        }
        hit = proProfile;
      }
      const firstName = String(hit.full_name ?? "").trim().split(/\s+/)[0] || null;
      const proFields = await callerProFields(admin, hit.user_id);
      await patchSession(admin, sessionId, {
        draft: {
          ...session.draft,
          caller_guess_user_id: hit.user_id,
          caller_guess_member_id: hit.public_user_number,
          caller_guess_name: hit.full_name,
          caller_phone_e164: phone,
          ...(proFields.is_pro ? { pro_profile_id: proFields.pro_profile_id } : {}),
        },
      });
      return {
        ok: true,
        matched: true,
        first_name: firstName,
        full_name: hit.full_name,
        member_id: hit.public_user_number,
        has_pin: !!(hit.voice_pin_hash && String(hit.voice_pin_hash).length > 0),
        ask_fr: firstName ? `Est-ce bien ${firstName}?` : "Est-ce bien vous?",
        ask_en: firstName ? `Am I speaking with ${firstName}?` : "Is this you?",
        if_not: "If not, say no or press 1.",
        ...proFields,
      };
    }

    case "lookup_member_id": {
      if (session.channel !== "phone") return { ok: false, error: "phone_channel_required" };
      const memberId = String(args.member_id ?? "").trim();
      if (!/^\\d{4}$/.test(memberId)) return { ok: false, error: "invalid_member_id" };
      const { data: profile } = await admin.from("profiles").select("user_id, public_user_number, full_name, voice_pin_hash").eq("public_user_number", memberId).maybeSingle();
      if (!profile) return { ok: false, error: "member_not_found" };
      await patchSession(admin, sessionId, { authenticated: false, customer_user_id: null, customer_member_id: null, otp_verified_at: null, draft: { ...session.draft, caller_guess_user_id: profile.user_id, caller_guess_member_id: profile.public_user_number, caller_guess_name: profile.full_name, member_id_lookup: true, pin_attempts: 0 } });
      return { ok: true, member_id_found: true, has_pin: !!profile.voice_pin_hash, authenticated: false };
    }

    case "clear_caller_guess": {
      const { caller_guess_user_id: _a, caller_guess_member_id: _b, caller_guess_name: _c, ...rest } =
        session.draft ?? {};
      await patchSession(admin, sessionId, { draft: { ...rest, caller_guess_cleared: true } });
      return { ok: true, cleared: true, next: "Ask for the four-digit Member ID, look it up, then verify the voice PIN on the keypad. Never send SMS. Pros use their 4-digit Pro ID." };
    }

    case "verify_voice_pin": {
      const guessUserId = String(session.draft?.caller_guess_user_id ?? "");
      if (!guessUserId) {
        return { ok: false, error: "no_caller_guess", message: "Call identify_caller and confirm identity first." };
      }
      const pin = String(args.pin ?? "").replace(/\D/g, "");
      if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "invalid_pin_format" };
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id, full_name, public_user_number, voice_pin_hash, voice_pin_failed_attempts, voice_pin_locked_until")
        .eq("user_id", guessUserId)
        .maybeSingle();
      if (!profile?.voice_pin_hash) {
        return {
          ok: false,
          error: "no_pin_set",
          message: "No voice PIN on file. Ask them to set one in secure account settings. Do not send SMS or reveal account information.",
        };
      }
      if (profile.voice_pin_locked_until && new Date(profile.voice_pin_locked_until).getTime() > Date.now()) return { ok: false, error: "pin_locked", message: "Phone PIN attempts are locked. Use secure account support." };
      const { data: okPin, error: pinErr } = await admin.rpc("verify_voice_pin_hash", {
        p_hash: profile.voice_pin_hash,
        p_pin: pin,
      });
      if (pinErr) return { ok: false, error: "pin_check_failed", detail: pinErr.message };
      if (okPin !== true) {
        const attempts = Number(profile.voice_pin_failed_attempts ?? 0) + 1;
        const lockedUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60_000).toISOString() : null;
        await admin.from("profiles").update({ voice_pin_failed_attempts: lockedUntil ? 0 : attempts, voice_pin_locked_until: lockedUntil }).eq("user_id", guessUserId);
        return { ok: false, error: lockedUntil ? "pin_locked" : "pin_incorrect" };
      }
      await admin.from("profiles").update({ voice_pin_failed_attempts: 0, voice_pin_locked_until: null }).eq("user_id", guessUserId);
      const proFields = await callerProFields(admin, profile.user_id);
      await patchSession(admin, sessionId, {
        authenticated: true,
        otp_verified_at: new Date().toISOString(),
        customer_user_id: profile.user_id,
        customer_member_id: profile.public_user_number,
        draft: {
          ...session.draft,
          auth_method: "voice_pin",
          ...(proFields.is_pro ? { role: "pro", pro_profile_id: proFields.pro_profile_id } : {}),
        },
      });
      return {
        ok: true,
        authenticated: true,
        name: profile.full_name,
        member_id: profile.public_user_number,
        ...proFields,
        next: proFields.is_pro ? "Call list_pro_bookings and offer to play the jobs." : undefined,
      };
    }

    case "begin_voice_pin_setup": {
      if (!session.authenticated || !session.otp_verified_at || session.channel !== "phone") return { ok: false, error: "phone_otp_required" };
      await patchSession(admin, sessionId, { flow: "pin_setup" });
      return { ok: true, keypad_setup: true };
    }
    case "set_voice_pin": {
      if (!session.authenticated || !session.otp_verified_at || session.channel !== "phone" || !session.customer_user_id) return { ok: false, error: "phone_otp_required" };
      const pin = String(args.pin ?? "").replace(/\D/g, "");
      if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "invalid_pin_format" };
      const { data, error } = await admin.rpc("set_front_desk_voice_pin", { p_user_id: session.customer_user_id, p_pin: pin });
      if (error || data !== true) return { ok: false, error: "pin_setup_failed" };
      await patchSession(admin, sessionId, { flow: "existing_booking", draft: { ...session.draft, auth_method: "keypad_pin_setup" } });
      return { ok: true, pin_set: true };
    }

    case "authenticate_member": {
      if (session.channel === "phone") return { ok: false, error: "sms_authentication_disabled", message: "Use lookup_member_id and keypad voice PIN. Never send SMS." };
      const requestedId = normalizeMemberId(String(args.member_id ?? ""));
      if (String(args.member_id ?? "").trim() && !/^\d{4}$/.test(requestedId)) return { ok: false, error: "invalid_member_id", message: "Member ID must contain exactly four digits." };
      const callerUserId = String(session.draft?.caller_guess_user_id ?? "");
      const callerMemberId = String(session.draft?.caller_guess_member_id ?? "");
      const memberId = requestedId || callerMemberId;
      if (!/^\d{4}$/.test(memberId)) return { ok: false, error: "invalid_member_id", message: "A four-digit Member ID is required when there is no unique phone match." };
      const action = String(args.action ?? "send_otp");
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id, full_name, phone, public_user_number")
        .eq("public_user_number", memberId)
        .maybeSingle();
      if (!profile || (callerUserId && !requestedId && profile.user_id !== callerUserId)) return { ok: false, error: "member_not_found", message: "No customer found for that Member ID." };
      const phone = toE164NorthAmerica(String(profile.phone ?? ""));
      if (!phone) return { ok: false, error: "no_phone", message: "This account has no phone number on file for OTP." };

      if (action === "send_otp") {
        const demo = session.channel === "demo" && (Deno.env.get("FRONT_DESK_DEMO_OTP") === "1" || !Deno.env.get("TELNYX_API_KEY"));
        if (demo) {
          await patchSession(admin, sessionId, {
            customer_user_id: profile.user_id,
            customer_member_id: memberId,
            otp_sent_at: new Date().toISOString(),
            draft: { ...session.draft, demo_otp: "000000", phone, otp_member_id: memberId, otp_user_id: profile.user_id },
          });
          return {
            ok: true,
            demo: true,
            message: "I've sent a six-digit verification code to your account's phone number. Please tell me the code. (Demo: use 000000)",
          };
        }
        const sent = await sendOtp(phone);
        if (!sent.ok) return { ok: false, error: "otp_send_failed", detail: sent.error };
        await patchSession(admin, sessionId, {
          customer_user_id: profile.user_id,
          customer_member_id: memberId,
          otp_sent_at: new Date().toISOString(),
          draft: { ...session.draft, phone, otp_member_id: memberId, otp_user_id: profile.user_id },
        });
        return { ok: true, message: "I've sent a six-digit verification code to your account's phone number. Please tell me the code." };
      }

      if (action === "check_otp") {
        const code = String(args.otp_code ?? "").replace(/\D/g, "");
        if (!session.otp_sent_at || String(session.draft?.otp_member_id ?? "") !== memberId || String(session.draft?.otp_user_id ?? "") !== profile.user_id) return { ok: false, error: "otp_session_mismatch" };
        const draftPhone = String(session.draft?.phone ?? phone);
        const demoCode = String(session.draft?.demo_otp ?? "");
        if (!(demoCode && code === demoCode)) {
          const checked = await checkOtp(draftPhone, code);
          if (!checked.ok) return { ok: false, error: "otp_invalid", detail: checked.error };
        }
        const proFields = await callerProFields(admin, profile.user_id);
        await patchSession(admin, sessionId, {
          authenticated: true,
          otp_verified_at: new Date().toISOString(),
          customer_user_id: profile.user_id,
          customer_member_id: memberId,
          draft: {
            ...session.draft,
            ...(proFields.is_pro ? { role: "pro", pro_profile_id: proFields.pro_profile_id } : {}),
          },
        });
        return { ok: true, authenticated: true, name: profile.full_name, member_id: memberId, ...proFields };
      }
      return { error: "bad_action" };
    }

    case "get_customer": {
      const denied = requireAuth();
      if (denied) return denied;
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, phone, public_user_number")
        .eq("user_id", session.customer_user_id!)
        .maybeSingle();
      return { ok: true, customer: profile };
    }

    case "search_services": {
      const query = String(args.query ?? "");
      const hits = searchCatalog(query);
      await patchSession(admin, sessionId, { draft: { ...session.draft, last_search: hits }, flow: "new_booking" });
      return {
        ok: true,
        matches: hits.map((h) => ({
          service_slug: h.slug,
          name_en: h.en,
          name_fr: h.fr,
          category: h.category,
          price_cad: h.price_cad,
          note: "Price from catalog — do not invent other prices.",
        })),
      };
    }

    case "get_service": {
      const slug = String(args.service_slug ?? "");
      const svc = DEMO_CATALOG.find((s) => s.slug === slug);
      if (!svc) return { error: "service_not_found" };
      const tax = Math.round(svc.price_cad * 0.14975 * 100) / 100;
      const total = Math.round((svc.price_cad + tax) * 100) / 100;
      await patchSession(admin, sessionId, {
        draft: { ...session.draft, selected_service: svc, quote: { subtotal: svc.price_cad, tax, total } },
      });
      return {
        ok: true,
        service: svc,
        quote: {
          subtotal_cad: svc.price_cad,
          tax_cad: tax,
          total_cad: total,
          currency: "CAD",
          cancellation_summary:
            "Cancellation is allowed under the conditions shown for this service; applicable cancellation fees may apply. Full terms are in the Alt Shift account.",
        },
      };
    }

    case "get_availability":
    case "list_demo_slots": {
      const date = args.date ? String(args.date) : null;
      const days = Number(args.days ?? 7);
      let q = admin
        .from("front_desk_demo_slots")
        .select("id, slot_date, slot_time, service_slug, status, booking_label")
        .eq("status", "open")
        .order("slot_date", { ascending: true })
        .order("slot_time", { ascending: true })
        .limit(80);
      if (date) q = q.eq("slot_date", date);
      else {
        const end = new Date();
        end.setDate(end.getDate() + days);
        q = q.gte("slot_date", new Date().toISOString().slice(0, 10)).lte("slot_date", end.toISOString().slice(0, 10));
      }
      if (args.service_slug) q = q.eq("service_slug", String(args.service_slug));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { ok: true, slots: data ?? [] };
    }

    case "confirm_terms": {
      const denied = requireAuth();
      if (denied) return denied;
      const accepted = Boolean(args.accepted);
      if (!accepted) return { ok: false, message: "Terms not accepted. Booking cannot proceed." };
      await patchSession(admin, sessionId, {
        draft: {
          ...session.draft,
          terms: {
            accepted: true,
            version: TERMS_VERSION,
            hash: TERMS_HASH,
            method: String(args.method ?? "voice"),
            at: new Date().toISOString(),
          },
        },
      });
      return { ok: true, booking_terms_version: TERMS_VERSION, terms_hash: TERMS_HASH };
    }

    case "create_booking": {
      const denied = requireAuth();
      if (denied) return denied;
      const terms = session.draft?.terms as { accepted?: boolean } | undefined;
      if (!terms?.accepted) return { error: "terms_required", message: "Call confirm_terms after the customer explicitly accepts." };
      const serviceSlug = String(args.service_slug ?? "");
      const preferredDate = String(args.preferred_date ?? "");
      const preferredTime = String(args.preferred_time ?? "").slice(0, 8);
      const svc = DEMO_CATALOG.find((s) => s.slug === serviceSlug);
      const quote = (session.draft?.quote as { total?: number; subtotal?: number; tax?: number }) ?? {
        subtotal: svc?.price_cad ?? 0,
        tax: 0,
        total: svc?.price_cad ?? 0,
      };
      const { data: slot } = await admin
        .from("front_desk_demo_slots")
        .select("id")
        .eq("slot_date", preferredDate)
        .eq("slot_time", preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime)
        .eq("service_slug", serviceSlug)
        .eq("status", "open")
        .maybeSingle();
      let publicCode = `A${String(Math.floor(10000 + Math.random() * 90000))}`;
      if (slot?.id) {
        await admin.from("front_desk_demo_slots").update({ status: "booked", booking_label: publicCode }).eq("id", slot.id);
      }
      let bookingId: string | null = null;
      const { data: pro } = await admin.from("pro_profiles").select("id").eq("is_verified", true).limit(1).maybeSingle();
      if (pro?.id) {
        const termsMeta = session.draft.terms as { version?: string; hash?: string; method?: string; at?: string };
        const { data: booking, error: bErr } = await admin
          .from("bookings")
          .insert({
            client_id: session.customer_user_id,
            pro_profile_id: pro.id,
            status: "pending",
            preferred_date: preferredDate,
            preferred_time: preferredTime.length === 5 ? preferredTime : preferredTime.slice(0, 5),
            service_slug: serviceSlug,
            service_category_slug: svc?.category ?? "outdoor",
            booking_terms_version: termsMeta?.version ?? TERMS_VERSION,
            terms_accepted_at: termsMeta?.at ?? new Date().toISOString(),
            terms_acceptance_method: termsMeta?.method ?? "voice",
            terms_hash: termsMeta?.hash ?? TERMS_HASH,
            cancel_policy_acknowledged_at: new Date().toISOString(),
            invoice_snapshot: {
              subtotal_cad: quote.subtotal,
              tax_cad: quote.tax,
              total_cad: quote.total,
              currency: "CAD",
              source: "front_desk",
            },
          })
          .select("id, public_booking_code")
          .maybeSingle();
        if (!bErr && booking) {
          bookingId = booking.id as string;
          publicCode = String(booking.public_booking_code ?? publicCode);
        }
      }
      await patchSession(admin, sessionId, {
        active_booking_id: bookingId,
        draft: {
          ...session.draft,
          last_booking: {
            id: bookingId,
            public_booking_code: publicCode,
            service_slug: serviceSlug,
            preferred_date: preferredDate,
            preferred_time: preferredTime,
            total_cad: quote.total,
            payment_status: "pending",
          },
        },
      });
      return {
        ok: true,
        booking_id: bookingId,
        booking_code: publicCode,
        payment_status: "pending",
        review: {
          service: svc?.en ?? serviceSlug,
          date: preferredDate,
          time: preferredTime,
          price_cad: quote.subtotal,
          taxes_cad: quote.tax,
          total_cad: quote.total,
          terms_version: TERMS_VERSION,
        },
        message: "Booking reserved. Complete payment in Alt Shift if no card was charged.",
      };
    }

    case "get_booking":
    case "get_booking_details": {
      const denied = requireAuth();
      if (denied) return denied;
      const code = normalizeBookingCode(String(args.booking_code ?? ""));
      const { data: booking } = await admin
        .from("bookings")
        .select("id, status, preferred_date, preferred_time, public_booking_code, service_slug, invoice_snapshot, pro_profile_id, client_id")
        .eq("public_booking_code", code)
        .maybeSingle();
      if (!booking) {
        const { data: demo } = await admin.from("front_desk_demo_slots").select("*").eq("booking_label", code).maybeSingle();
        if (demo) return { ok: true, source: "demo", booking: demo };
        return { error: "booking_not_found" };
      }
      if (booking.client_id !== session.customer_user_id) {
        return { error: "forbidden", message: "This booking does not belong to the authenticated member." };
      }
      const { data: professional } = await admin
        .from("pro_profiles")
        .select("business_name, pro_member_id, phone")
        .eq("id", booking.pro_profile_id)
        .maybeSingle();
      return { ok: true, booking, professional };
    }

    case "get_payment_method": {
      const denied = requireAuth();
      if (denied) return denied;
      const hasDemo = Deno.env.get("FRONT_DESK_DEMO_CARD_LAST4");
      if (hasDemo) return { ok: true, has_saved_card: true, last4: hasDemo, brand: "VISA" };
      return {
        ok: true,
        has_saved_card: false,
        message: "You don't currently have a payment method saved. I can reserve the booking, and you can complete payment securely through your Alt Shift account.",
      };
    }

    case "create_payment_request": {
      const denied = requireAuth();
      if (denied) return denied;
      const last = session.draft?.last_booking as { public_booking_code?: string } | undefined;
      return {
        ok: true,
        payment_status: "pending",
        checkout_url: `${SITE}/dashboard?tab=bookings`,
        sms_hint: `Complete your payment for booking ${last?.public_booking_code ?? ""} in your Alt Shift account.`,
      };
    }

    case "charge_saved_payment_method": {
      const denied = requireAuth();
      if (denied) return denied;
      if (!args.confirm) return { ok: false, message: "Customer must confirm the charge." };
      const last4 = Deno.env.get("FRONT_DESK_DEMO_CARD_LAST4");
      if (!last4) return { ok: false, payment_status: "pending", message: "No saved card. Use create_payment_request instead." };
      return { ok: true, charged: true, demo: true, last4, message: "Demo charge recorded. Connect Square charge for production." };
    }

    case "create_support_ticket":
    case "create_complaint":
    case "create_feedback":
    case "create_feature_request":
    case "escalate_to_admin": {
      const denied = requireAuth();
      if (denied) return denied;
      let kind = "question";
      if (name === "create_complaint") kind = "complaint";
      else if (name === "create_feedback") kind = "feedback";
      else if (name === "create_feature_request") kind = "feature_request";
      else if (name === "escalate_to_admin") kind = "escalation";
      else kind = String(args.kind ?? "question");
      let bookingId: string | null = null;
      if (args.booking_code) {
        const { data: b } = await admin
          .from("bookings")
          .select("id")
          .eq("public_booking_code", normalizeBookingCode(String(args.booking_code)))
          .maybeSingle();
        bookingId = (b?.id as string) ?? null;
      }
      const body = String(args.body ?? args.reason ?? "");
      const { data: ticket, error } = await admin
        .from("front_desk_tickets")
        .insert({
          session_id: sessionId,
          customer_user_id: session.customer_user_id,
          booking_id: bookingId,
          kind,
          subject: args.subject ? String(args.subject) : kind,
          body,
          status: "open",
        })
        .select("id, kind, status")
        .maybeSingle();
      if (error) return { error: error.message };
      return { ok: true, ticket };
    }

    case "send_confirmation": {
      const denied = requireAuth();
      if (denied) return denied;
      const last = session.draft?.last_booking;
      const bookingId = args.booking_id ? String(args.booking_id) : (last as { id?: string } | undefined)?.id;
      if (bookingId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
        try {
          await fetch(`${supabaseUrl}/functions/v1/booking-sms-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}`, apikey: anon },
            body: JSON.stringify({ booking_id: bookingId, event: "confirmation" }),
          });
        } catch { /* ignore */ }
      }
      return {
        ok: true,
        channels: ["account", "sms_best_effort"],
        booking: last,
        message: "Confirmation will appear in your Alt Shift account. SMS sent when Pro SMS automation applies.",
      };
    }

    case "close_session": {
      await patchSession(admin, sessionId, { closed_at: new Date().toISOString() });
      return { ok: true, closed: true };
    }

    default: {
      const proResult = await handleProTool(admin, session, name, args, {
        patch: (patch) => patchSession(admin, sessionId, patch),
        sendOtp,
        checkOtp,
        toE164: toE164NorthAmerica,
      });
      if (proResult !== null) return proResult;
      return { error: "unknown_tool", name };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-front-desk-secret");
  const expected = Deno.env.get("FRONT_DESK_SECRET");
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  let allowed = !!(expected && secret === expected);
  if (!allowed && authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token && token === serviceKey) allowed = true;
    else {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      allowed = !!user;
    }
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "tool");
  const toolName = String(body.name ?? body.tool_name ?? "");
  const publicOk =
    action === "create_session" ||
    (action === "tool" && (toolName === "list_demo_slots" || toolName === "get_availability" || toolName === "search_services"));
  if (!allowed && (Deno.env.get("FRONT_DESK_PUBLIC_DEMO") === "1" || publicOk)) allowed = true;
  if (!allowed) return json({ error: "Forbidden" }, 403);

  if (action === "create_session") {
    const channel = String(body.channel ?? "web");
    const language = body.language === "fr" ? "fr" : "en";
    const { data, error } = await admin.from("front_desk_sessions").insert({ channel, language, draft: {} }).select("id").maybeSingle();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, session_id: data?.id });
  }

  if (action === "tool") {
    const result = await executeTool(admin, toolName, (body.arguments ?? body.args ?? {}) as Record<string, unknown>);
    return json({ ok: true, result });
  }

  return json({ error: "unknown_action" }, 400);
});
