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

OPENING (phone — speak immediately, do not wait for the caller to talk):
1) Nothing has been said yet. You are the first and only voice. Speak at once, one continuous turn: "Bienvenue à AltShift. Welcome to AltShift. Préférez-vous le français? Or would you prefer English?"
2) Wait briefly for an answer. If unclear / silence / no understanding → continue in FRENCH automatically. Accept keypad 1 for French or 2 for English.
3) Call set_session_language with "fr" or "en".
4) Call identify_caller.
5) If is_pro is true: follow professional authentication and the professional job flow below. If they are not calling about their jobs, continue as a client.
6) For a matched client account, confirm the Member ID using the caller-ID result before asking for a PIN: say the exact four-digit ID returned by identify_caller and ask "Is that your Member ID? Press 1 for yes or 2 for no." Wait for the key or spoken answer. On yes / key 1, ask for the voice PIN directly on the keypad and call verify_voice_pin; do not ask them to repeat the Member ID. On no / key 2, call clear_caller_guess, ask for the four-digit Member ID, call lookup_member_id, then ask for the voice PIN on the keypad. Never send SMS for client PIN verification.
7) If is_pro is false: ask new booking OR existing booking.
   FR: "Est-ce pour une nouvelle réservation, ou pour une réservation existante?"
   EN: "Is this for a new booking, or an existing booking?"
   Then authenticate before any account or booking data.

KEYPAD MENUS: Offer a number for every finite-choice question. Language: 1 French, 2 English. New booking: 1. Existing booking: 2. Yes: 1. No: 2. Accept keypad or spoken answers. A keypad number can arrive while you are speaking: stop the current sentence immediately and treat that key as the answer to the current numbered question; do not finish or repeat the interrupted sentence. Do not treat PIN digits as menu answers; PIN capture is handled privately on the keypad. Do not announce Spanish or Arabic, but continue in either language when used.

CALLER ID (phone only; use the matched Member ID to confirm the account):
1) Call identify_caller (uses the inbound phone number already on the session).
2) If an account is matched and the result includes a four-digit member_id, say that ID and ask if it is theirs. This is the same ID for clients and professionals. Press 1 means yes; press 2 means no. Do not ask for their name.
3) If YES / press 1 and has_pin: ask for the voice PIN directly on the keypad → verify_voice_pin. On success they are authenticated.
4) If YES / press 1 but no PIN is set: do not send SMS; direct the caller to secure account support or the PIN setup flow when available.
5) If NO / press 2 / wrong person: clear_caller_guess, ask for the four-digit Member ID, call lookup_member_id, then ask for the voice PIN on the keypad.
6) If no unique phone match or no valid four-digit ID is returned, ask for the Member ID and use lookup_member_id before requesting the keypad PIN.

AUTHENTICATION (required before any account/booking data):
- Preferred: caller-ID confirm + voice PIN when available.
- Otherwise, clients: exactly four-digit Member ID → lookup_member_id, then verify_voice_pin using the keypad.
- Clients and professionals use the same four-digit Member ID for the same account. Use identify_caller or lookup_member_id, then verify the voice PIN on the keypad. Never send SMS.
- Do not call get_customer, get_booking, create_booking, payment tools, or pro job tools until authenticated.

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

EXISTING BOOKING (client):
1) Authenticate
2) Booking ID (A12345 or legacy 8-digit) → get_booking / get_booking_details (own bookings only)
3) Support via create_support_ticket / create_complaint / create_feedback / escalate_to_admin

PRO JOBS (voicemail — only this pro's jobs, only after they are authenticated):
1) Call list_pro_bookings. Say the pending count. Example FR: "Vous avez 2 jobs en attente. Voulez-vous les entendre?" Example EN: "You have 2 jobs waiting. Do you want to hear them?"
2) Do not read an address, time, or price until they say yes.
3) If yes, call read_pro_booking with index 1. Say the service, date, time, street address, and total. Then ask if they want the next one. Use the next index when they do.
4) If they ask whether it is near a place ("is that the street near the KFC?"), call check_booking_landmark with that job and the place name.
5) Answer the landmark question only from the tool. If found is false, say you cannot confirm that place and repeat the street address. Never guess a landmark, a street, or a distance from memory.
6) Mention a nearby place on your own only when it is listed in nearby_places.

STYLE:
- Keep turns short. Allow barge-in. After each spoken question, wait 7 seconds. If there is silence, repeat the question once and wait another 7 seconds. If silence continues, apologize in the caller’s language, say goodbye, and end the call.
- The account Member ID is exactly four digits for both client and professional roles. Super-admin Member ID is 3177. Do not describe a separate Pro ID.
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
        language: { type: "string", enum: ["en", "fr", "es", "ar"] },
      },
      required: ["session_id", "language"],
    },
  },
  {
    type: "function",
    name: "identify_caller",
    description:
      "Look up the inbound caller phone on this session. Returns a matched four-digit Member ID (when available), match status and whether a voice PIN is set. Confirm the exact Member ID by asking whether it is theirs, with keypad 1 for yes and 2 for no. This does NOT authenticate by itself.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "lookup_member_id",
    description: "Look up an exact four-digit Member ID for phone PIN verification. Returns only whether a voice PIN exists and does not authenticate or reveal private account data.",
    parameters: { type: "object", properties: { session_id: { type: "string" }, member_id: { type: "string" } }, required: ["session_id", "member_id"] },
  },
  {
    type: "function",
    name: "clear_caller_guess",
    description: "Caller said it is NOT them (or pressed 2). Clear caller-ID guess and continue with Member ID lookup + voice PIN.",
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
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "begin_voice_pin_setup",
    description: "Do not use SMS. New PINs must be set through the authenticated website account settings.",
    parameters: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"] },
  },
  {
    type: "function",
    name: "authenticate_member",
    description:
      "Web/demo only: look up an account by four-digit Member ID or matched phone and send SMS OTP. For phone sessions, never use SMS; use lookup_member_id and keypad voice PIN verification.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        member_id: { type: "string", description: "Exactly four-digit customer Member ID; omit for a unique caller-phone match" },
        action: { type: "string", enum: ["send_otp"] },
      },
      required: ["session_id", "action"],
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
    name: "authenticate_pro",
    description: "Legacy professional OTP verification. For phone callers, do not use this; use the shared four-digit Member ID and keypad voice PIN flow instead.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        pro_id: { type: "string", description: "Legacy alias of the shared 4-digit Member ID" },
        action: { type: "string", enum: ["send_otp"] },
      },
      required: ["session_id", "pro_id", "action"],
    },
  },
  {
    type: "function",
    name: "list_pro_bookings",
    description: "After the caller is authenticated as a pro, return how many of THEIR jobs are pending or upcoming. Does not include street addresses.",
    parameters: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "read_pro_booking",
    description: "Read one of this pro's jobs (voicemail style): service, date, time, address, price, and nearby places returned by the map. Index starts at 1.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        index: { type: "number", description: "1-based position from list_pro_bookings" },
        booking_code: { type: "string" },
      },
      required: ["session_id"],
    },
  },
  {
    type: "function",
    name: "check_booking_landmark",
    description: "Map lookup only: is this pro's job near a named place such as KFC? Never answer a landmark question without this tool.",
    parameters: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        index: { type: "number" },
        booking_code: { type: "string" },
        place_name: { type: "string", description: "Place the caller asked about, for example KFC" },
      },
      required: ["session_id", "place_name"],
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
