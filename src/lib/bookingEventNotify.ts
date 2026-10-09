import { supabase } from "@/integrations/supabase/client";

/**
 * Best-effort booking notifications after a booking changes state.
 * - Email (all plans): send-app-email booking_created / booking_confirmed to the client.
 * - SMS (Pro plan only, enforced on the server): booking-sms-notify.
 * Never throws; a failed notification must not block the booking flow.
 */
export async function notifyBookingEvent(bookingId: string, kind: "created" | "confirmed"): Promise<void> {
  if (!bookingId) return;
  const emailType = kind === "created" ? "booking_created" : "booking_confirmed";
  await Promise.allSettled([
    supabase.functions.invoke("send-app-email", { body: { type: emailType, booking_id: bookingId } }),
    supabase.functions.invoke("booking-sms-notify", {
      body: { booking_id: bookingId, event: kind === "created" ? "request" : "confirmation" },
    }),
  ]);
}
