import { supabase } from "@/integrations/supabase/client";

export type UnreadBookingNotificationBreakdown = {
  client: number;
  pro: number;
  total: number;
};

/** Count bookings needing client or pro attention (requires migration columns). */
export async function fetchUnreadBookingNotificationBreakdown(
  userId: string,
): Promise<UnreadBookingNotificationBreakdown> {
  const c1 = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", userId)
    .eq("client_unread", true);
  let client = 0;
  if (!c1.error || !columnMissing(c1.error.message)) {
    client = c1.count ?? 0;
  }

  const { data: proRow } = await supabase.from("pro_profiles").select("id").eq("user_id", userId).maybeSingle();
  const proId = proRow?.id as string | undefined;
  let pro = 0;
  if (proId) {
    const c2 = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("pro_profile_id", proId)
      .eq("pro_unread", true);
    if (!c2.error || !columnMissing(c2.error.message)) {
      pro = c2.count ?? 0;
    }
  }

  return { client, pro, total: client + pro };
}

/** Count bookings needing client or pro attention (requires migration columns). */
export async function fetchUnreadBookingNotificationCount(userId: string): Promise<number> {
  const { total } = await fetchUnreadBookingNotificationBreakdown(userId);
  return total;
}

function columnMissing(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("client_unread") ||
    m.includes("pro_unread") ||
    m.includes("acknowledge_client_booking_notifications") ||
    m.includes("schema cache")
  );
}

function rpcMissing(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("acknowledge_client_booking_notifications") || m.includes("could not find the function");
}

export async function rpcAcknowledgeClientBooking(bookingId: string): Promise<boolean> {
  const { error } = await supabase.rpc("acknowledge_client_booking", { p_booking_id: bookingId });
  return !error;
}

export async function rpcAcknowledgeProBookingNotifications(): Promise<boolean> {
  const { error } = await supabase.rpc("acknowledge_pro_booking_notifications");
  return !error;
}

export async function rpcAcknowledgeClientBookingNotifications(): Promise<boolean> {
  const { error } = await supabase.rpc("acknowledge_client_booking_notifications");
  if (!error) return true;
  if (!rpcMissing(error.message)) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;

  const { error: updErr } = await supabase
    .from("bookings")
    .update({ client_unread: false })
    .eq("client_id", user.id)
    .eq("client_unread", true);
  return !updErr;
}

/** Clear all unread booking flags for the signed-in user (client + pro). */
export async function rpcAcknowledgeAllBookingNotifications(): Promise<void> {
  await Promise.all([rpcAcknowledgeClientBookingNotifications(), rpcAcknowledgeProBookingNotifications()]);
}
