import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export const PRO_BOOKING_SELECT =
  "id, created_at, preferred_date, preferred_time, service_duration_minutes, status, client_id, decline_reason, responded_at, auto_reply_snapshot, service_category_slug, service_slug, client_renews_annually, renewal_anchor_date, renewal_interval_months_snapshot, invoice_snapshot, public_booking_code, service_location_choice, distance_km_snapshot, drive_minutes_snapshot, pro_unread";

export type ProBookingRealtimeRow = {
  id: string;
  created_at: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  service_duration_minutes?: number | null;
  status: string;
  client_id: string;
  decline_reason?: string | null;
  responded_at?: string | null;
  auto_reply_snapshot?: string | null;
  service_category_slug?: string | null;
  service_slug?: string | null;
  client_renews_annually?: boolean | null;
  renewal_anchor_date?: string | null;
  renewal_interval_months_snapshot?: number | null;
  invoice_snapshot?: unknown;
  public_booking_code?: string | null;
  service_location_choice?: string | null;
  distance_km_snapshot?: number | null;
  drive_minutes_snapshot?: number | null;
  pro_unread?: boolean | null;
};

type Handlers = {
  onInsert?: (row: ProBookingRealtimeRow) => void;
  onUpdate?: (row: ProBookingRealtimeRow) => void;
  onDelete?: (id: string) => void;
};

/** Live booking updates for a verified pro (Supabase Realtime + optional poll fallback). */
export function useProBookingsRealtime(
  proProfileId: string | null | undefined,
  enabled: boolean,
  handlers: Handlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !proProfileId) return;

    const applyPayload = (payload: RealtimePostgresChangesPayload<ProBookingRealtimeRow>) => {
      if (payload.eventType === "INSERT" && payload.new?.id) {
        handlersRef.current.onInsert?.(payload.new as ProBookingRealtimeRow);
        return;
      }
      if (payload.eventType === "UPDATE" && payload.new?.id) {
        handlersRef.current.onUpdate?.(payload.new as ProBookingRealtimeRow);
        return;
      }
      if (payload.eventType === "DELETE" && payload.old?.id) {
        handlersRef.current.onDelete?.(String(payload.old.id));
      }
    };

    const channel = supabase
      .channel(`pro-bookings-${proProfileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `pro_profile_id=eq.${proProfileId}`,
        },
        (payload) => {
          applyPayload(payload as RealtimePostgresChangesPayload<ProBookingRealtimeRow>);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, proProfileId]);
}
