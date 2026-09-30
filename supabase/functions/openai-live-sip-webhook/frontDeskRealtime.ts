/**
 * Front Desk tool definitions + system instructions for OpenAI Realtime (gpt-realtime).
 * No web_search. All business logic runs in front-desk-tools.
 */

export const FRONT_DESK_MODEL = "gpt-realtime";

export const FRONT_DESK_VOICE = "marin";

export const FRONT_DESK_INSTRUCTIONS = `You are AltShift Front Desk, the phone and web voice assistant for Les Services AltShift Inc. (altshift.ca).

SCOPE (strict):
- Only help with AltShift services, accounts, bookings, payments on AltShift, and support tickets.
- You have NO web search and must NEVER invent general knowledge (weather, news, sports, etc.).
- If asked something outside AltShift, say: "I can help with Alt Shift services and your account, but I can't look up general information outside of Alt Shift."
- Database tools only return THIS authenticated customer's data. Never invent account facts.

OPENING (phone — speak immediately, do not wait):
1) TeXML may already have said "Bienvenue à AltShift." Do not repeat it and do not say "un instant". Immediately ask bilingual: "Préférez-vous le français? Or would you prefer English?"
2) Wait briefly for an answer. If unclear / silence / no understanding → continue in FRENCH automatically.
3) Call set_session_language with "fr" or "en".
4) In the chosen language, ask: new booking OR existing booking.
   FR: "Est-ce pour une nouvelle réservation, ou pour une réservation existante?"
   EN: "Is this for a new booking, or an existing booking?"
5) Then identify_caller (phone) and auth before any account/booking data.

CALLER ID (phone only, before Member ID when tools report a match):
1) Call identify_caller (uses the inbound phone number already on the session).
2) If matched: ask "Est-ce bien [first name]?" / "Am I speaking with [first name]?"
3) If YES and has_pin: ask for voice PIN → verify_voice_pin. On success they are authenticated.
4) If YES but no PIN set: ask them to create a PIN in My Account, then fall back to Member ID + OTP.
5) If NO / "press 1" / wrong person: clear_caller_guess, then Member ID + OTP path.

AUTHENTICATION (required before any account/booking data):
- Preferred: caller-ID confirm + voice PIN when available.
- Otherwise: six-digit Member ID → authenticate_member send_otp → check_otp.
- Do not call get_customer, get_booking, create_booking, payment tools until authenticated.

HOLD / WAIT:
- While tools run, say briefly: "Un moment s'il vous plaît." / "One moment please." (no dead silence).
- True hold music is not available on this AI SIP path; spoken wait is required.

NEW BOOKING:
1) Authenticate
2) Ask what service they need
3) search_services — never invent catalog items
4) Confirm service → get_availability → get_service for price (backend only)
5) Terms → confirm_terms after explicit accept
6) Payment tools → create_booking → send_confirmation

EXISTING BOOKING:
1) Authenticate
2) Booking ID (A12345 or legacy 8-digit) → get_booking / get_booking_details (own bookings only)
3) Support via create_support_ticket / create_complaint / create_feedback / escalate_to_admin

STYLE:
- Keep turns short. Allow barge-in.
- Customer Member IDs = 6 digits. Pro IDs = 4 digits (pros only).
`;

export const FRONT_DESK_TOOLS = [
  {
    type: "function",
    name: "set_session_language",
    description: "Set session language after the caller chooses French or English (or after French default).",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        language: { type: "string", enum: ["en", "fr"] },
      },
      required: ["session_id", "language"],
    },
  },
  {
    type: "function",
    name: "identify_caller",
    description:
      "Look up the inbound caller phone on this session. Returns possible first name + whether a voice PIN is set. Does NOT authenticate by itself.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "clear_caller_guess",
    description: "Caller said it is NOT them (or pressed 1). Clear caller-ID guess and continue with Member ID + OTP.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "verify_voice_pin",
    description:
      "After caller confirms identity, verify their 4–6 digit voice PIN from My Account. On success authenticates the session.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        pin: { type: "string", description: "4–6 digit voice PIN" },
      },
      required: ["session_id", "pin"],
    },
  },
  {
    type: "function",
    name: "authenticate_member",
    description:
      "Look up customer by 6-digit Member ID and send/check SMS OTP. Required before account actions when PIN/caller-ID path is unavailable.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        member_id: { type: "string", description: "6-digit customer Member ID" },
        action: { type: "string", enum: ["send_otp", "check_otp"] },
        otp_code: { type: "string", description: "6-digit code when action=check_otp" },
      },
      required: ["session_id", "member_id", "action"],
    },
  },
  {
    type: "function",
    name: "get_customer",
    description: "Return authenticated customer profile summary for this session.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "search_services",
    description: "Search AltShift service catalog from natural language (demo + live catalog).",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        query: { type: "string" },
        language: { type: "string", enum: ["en", "fr"] },
      },
      required: ["session_id", "query"],
    },
  },
  {
    type: "function",
    name: "get_service",
    description: "Get service details and backend price quote. Never invent pricing.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        service_slug: { type: "string" },
        pro_profile_id: { type: "string" },
      },
      required: ["session_id", "service_slug"],
    },
  },
  {
    type: "function",
    name: "get_availability",
    description: "Check open appointment slots for a date (demo calendar or pro schedule).",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        service_slug: { type: "string" },
      },
      required: ["session_id", "date"],
    },
  },
  {
    type: "function",
    name: "list_demo_slots",
    description: "List upcoming demo Front Desk open slots for the UI calendar.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" }, days: { type: "number" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "get_booking",
    description: "Look up a booking by public Booking ID (A12345 or legacy 8-digit).",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        booking_code: { type: "string" },
      },
      required: ["session_id", "booking_code"],
    },
  },
  {
    type: "function",
    name: "get_booking_details",
    description: "Full booking details for authenticated customer.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        booking_code: { type: "string" },
      },
      required: ["session_id", "booking_code"],
    },
  },
  {
    type: "function",
    name: "confirm_terms",
    description: "Record explicit terms acceptance before create_booking.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        accepted: { type: "boolean" },
        method: { type: "string", enum: ["voice", "web"] },
      },
      required: ["session_id", "accepted"],
    },
  },
  {
    type: "function",
    name: "create_booking",
    description: "Create booking after auth + terms. Uses backend pricing only.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        service_slug: { type: "string" },
        preferred_date: { type: "string" },
        preferred_time: { type: "string" },
        demo: { type: "boolean", description: "If true, book a demo slot only" },
      },
      required: ["session_id", "service_slug", "preferred_date", "preferred_time"],
    },
  },
  {
    type: "function",
    name: "get_payment_method",
    description: "Return saved card last4 if any (demo may simulate).",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "create_payment_request",
    description: "Mark payment pending and return secure checkout instructions.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" }, booking_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "charge_saved_payment_method",
    description: "Charge saved card via Square when available; otherwise return pending.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        booking_id: { type: "string" },
        confirm: { type: "boolean" },
      },
      required: ["session_id", "confirm"],
    },
  },
  {
    type: "function",
    name: "create_support_ticket",
    description: "Create a general support ticket.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        kind: { type: "string", enum: ["question", "complaint", "feedback", "feature_request", "escalation"] },
        subject: { type: "string" },
        body: { type: "string" },
        booking_code: { type: "string" },
      },
      required: ["session_id", "kind", "body"],
    },
  },
  {
    type: "function",
    name: "create_complaint",
    description: "Shortcut for complaint ticket.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        body: { type: "string" },
        booking_code: { type: "string" },
      },
      required: ["session_id", "body"],
    },
  },
  {
    type: "function",
    name: "create_feedback",
    description: "Shortcut for feedback ticket.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        body: { type: "string" },
      },
      required: ["session_id", "body"],
    },
  },
  {
    type: "function",
    name: "create_feature_request",
    description: "Shortcut for feature request ticket.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        body: { type: "string" },
      },
      required: ["session_id", "body"],
    },
  },
  {
    type: "function",
    name: "send_confirmation",
    description: "Send SMS/email confirmation after booking (best-effort).",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        booking_id: { type: "string" },
      },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "escalate_to_admin",
    description: "Escalate to AltShift admin dashboard ticket.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        reason: { type: "string" },
        booking_code: { type: "string" },
      },
      required: ["session_id", "reason"],
    },
  },
  {
    type: "function",
    name: "close_session",
    description: "End the Front Desk voice session politely.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
] as const;
