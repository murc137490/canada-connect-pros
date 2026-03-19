import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const STORAGE_KEY = "premiere-booking-notifications-seen";

type NotificationContextType = {
  /** Number of unread notifications (e.g. new quotes). Mock: 1 until user views booking tab. */
  count: number;
  /** Call when user has viewed notifications (e.g. opened booking tab). */
  markSeen: () => void;
  /** Set count (e.g. from server). For mock, set to 1 on load if not seen. */
  setCount: (n: number) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [count, setCountState] = useState(0);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {}
    setCountState(0);
  }, []);

  const setCount = useCallback((n: number) => {
    setCountState(Math.max(0, n));
  }, []);

  return (
    <NotificationContext.Provider value={{ count, markSeen, setCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  return ctx ?? { count: 0, markSeen: () => {}, setCount: () => {} };
}

/** Returns true if user has not viewed booking tab since we set a mock notification. */
export function shouldShowMockBookingNotification(): boolean {
  try {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) return true;
    return false;
  } catch {
    return false;
  }
}
