import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatModerationNoticeBody, type WhatsNewItem } from "@/lib/whatsNewFeed";

type BookingRow = { id: string; created_at: string; client_unread?: boolean | null; pro_unread?: boolean | null };
type ReviewPending = { id: string; created_at: string; label: string };
type BroadcastRow = { id: string; title: string; body: string | null; href: string; created_at: string };
type ModerationNotice = {
  id: string;
  title: string;
  body: string;
  rules_reminder: string | null;
  created_at: string;
};

export function useWhatsNewItems(opts: {
  clientBookings: BookingRow[];
  proBookings: BookingRow[];
  pendingReviewNotices: ReviewPending[];
  platformAnnouncements: BroadcastRow[];
  jobModerationNotices: ModerationNotice[];
  isVerifiedPro: boolean;
  isPlatformAdmin?: boolean;
}) {
  const { t } = useLanguage();
  const {
    clientBookings,
    proBookings,
    pendingReviewNotices,
    platformAnnouncements,
    jobModerationNotices,
    isVerifiedPro,
    isPlatformAdmin,
  } = opts;

  return useMemo(() => {
    const items: WhatsNewItem[] = [];

    for (const b of clientBookings.filter((x) => x.client_unread)) {
      items.push({
        id: `booking-client-${b.id}`,
        kind: "booking",
        title: t.dashboard.whatsNewBookingClient ?? "Booking update",
        body: t.dashboard.whatsNewBookingClientBody ?? "A professional responded to your booking.",
        href: "/dashboard?tab=bookings",
        createdAt: b.created_at,
      });
    }

    if (isVerifiedPro) {
      for (const b of proBookings.filter((x) => x.pro_unread)) {
        items.push({
          id: `booking-pro-${b.id}`,
          kind: "booking",
          title: t.dashboard.whatsNewBookingPro ?? "New booking request",
          href: "/dashboard?tab=bookings",
          createdAt: b.created_at,
        });
      }
    }

    for (const r of pendingReviewNotices) {
      items.push({
        id: r.id,
        kind: "review",
        title: r.label,
        href: "/dashboard?tab=reviews",
        createdAt: r.created_at,
      });
    }

    for (const a of platformAnnouncements) {
      items.push({
        id: `announcement-${a.id}`,
        kind: "announcement",
        title: a.title,
        body: a.body ?? undefined,
        href: a.href || "/dashboard",
        createdAt: a.created_at,
      });
    }

    for (const n of jobModerationNotices) {
      items.push({
        id: `moderation-${n.id}`,
        kind: "moderation",
        title: n.title,
        body: formatModerationNoticeBody(n),
        href: "/make-request",
        createdAt: n.created_at,
      });
    }

    if (!isPlatformAdmin) {
      items.push({
        id: "platform-welcome",
        kind: "platform",
        title: t.dashboard.whatsNewPlatformTitle ?? "Welcome to Premiere Services",
        body: t.dashboard.whatsNewPlatformBody ?? "Manage bookings, reviews, and your pro profile from your dashboard.",
        href: "/dashboard",
        createdAt: new Date().toISOString(),
      });
    }

    return items;
  }, [
    clientBookings,
    proBookings,
    pendingReviewNotices,
    platformAnnouncements,
    jobModerationNotices,
    isVerifiedPro,
    isPlatformAdmin,
    t.dashboard.whatsNewBookingClient,
    t.dashboard.whatsNewBookingClientBody,
    t.dashboard.whatsNewBookingPro,
    t.dashboard.whatsNewPlatformTitle,
    t.dashboard.whatsNewPlatformBody,
  ]);
}
