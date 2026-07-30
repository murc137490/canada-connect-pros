import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchUnreadBookingNotificationBreakdown,
  type UnreadBookingNotificationBreakdown,
} from "@/lib/bookingNotifications";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";

type NotificationContextType = {
  count: number;
  unreadBreakdown: UnreadBookingNotificationBreakdown;
  /** Legacy: clears badge locally (prefer refreshBookingNotificationCount after DB ack). */
  markSeen: () => void;
  setCount: (n: number) => void;
  /** Re-fetch unread booking count from Supabase (after acknowledge or booking change). */
  refreshBookingNotificationCount: () => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCountState] = useState(0);
  const [unreadBreakdown, setUnreadBreakdown] = useState<UnreadBookingNotificationBreakdown>({
    client: 0,
    pro: 0,
    total: 0,
  });
  const [bookingPollKey, setBookingPollKey] = useState(0);

  const refreshBookingNotificationCount = useCallback(() => {
    setBookingPollKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user?.id || isPlatformAdminEmail(user.email)) return;
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    void (async () => {
      const clientChannel = supabase
        .channel(`booking-notifications-client-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `client_id=eq.${user.id}` },
          () => {
            refreshBookingNotificationCount();
          },
        )
        .subscribe();
      if (cancelled) {
        void supabase.removeChannel(clientChannel);
        return;
      }
      channels.push(clientChannel);

      const { data: proRow } = await supabase.from("pro_profiles").select("id, is_verified").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (proRow?.is_verified && proRow.id) {
        const proChannel = supabase
          .channel(`booking-notifications-pro-${proRow.id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "bookings", filter: `pro_profile_id=eq.${proRow.id}` },
            () => {
              refreshBookingNotificationCount();
            },
          )
          .subscribe();
        if (cancelled) {
          void supabase.removeChannel(proChannel);
          return;
        }
        channels.push(proChannel);
      }
    })();
    return () => {
      cancelled = true;
      channels.forEach((ch) => void supabase.removeChannel(ch));
    };
  }, [user?.id, user?.email, refreshBookingNotificationCount]);

  useEffect(() => {
    if (!user?.id) {
      setCountState(0);
      setUnreadBreakdown({ client: 0, pro: 0, total: 0 });
      return;
    }
    if (isPlatformAdminEmail(user.email)) {
      setCountState(0);
      setUnreadBreakdown({ client: 0, pro: 0, total: 0 });
      return;
    }
    let cancelled = false;
    (async () => {
      const breakdown = await fetchUnreadBookingNotificationBreakdown(user.id);
      if (!cancelled) {
        setUnreadBreakdown(breakdown);
        setCountState(Math.max(0, breakdown.total));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, bookingPollKey]);

  const markSeen = useCallback(() => {
    setCountState(0);
    setUnreadBreakdown({ client: 0, pro: 0, total: 0 });
  }, []);

  const setCount = useCallback((n: number) => {
    setCountState(Math.max(0, n));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ count, unreadBreakdown, markSeen, setCount, refreshBookingNotificationCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return (
    ctx ?? {
      count: 0,
      unreadBreakdown: { client: 0, pro: 0, total: 0 },
      markSeen: () => {},
      setCount: () => {},
      refreshBookingNotificationCount: () => {},
    }
  );
}

/** @deprecated No longer used for booking badge; kept for any legacy callers. */
export function shouldShowMockBookingNotification(): boolean {
  return false;
}
