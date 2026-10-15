import { fetchMyProProfile } from "@/lib/proProfileAccess";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWhatsNewItems } from "@/hooks/useWhatsNewItems";
import {
  REVIEWS_CHANGED_EVENT,
  fetchPendingReviewNotices,
  type PendingReviewNotice,
} from "@/lib/fetchPendingReviewNotices";
import {
  fetchActivePlatformWhatsNewAnnouncements,
  type PlatformWhatsNewRow,
} from "@/lib/fetchPlatformWhatsNewAnnouncements";
import { fetchJobRequestModerationNotices } from "@/lib/fetchJobRequestModerationNotices";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { WHATS_NEW_CHANGED_EVENT, type WhatsNewItem } from "@/lib/whatsNewFeed";

type Ctx = { items: WhatsNewItem[]; refresh: () => Promise<void> };

const WhatsNewContext = createContext<Ctx>({ items: [], refresh: async () => {} });

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isPlatformAdmin = isPlatformAdminEmail(user?.email);
  const [clientBookings, setClientBookings] = useState<
    { id: string; created_at: string; client_unread?: boolean | null }[]
  >([]);
  const [proBookings, setProBookings] = useState<
    { id: string; created_at: string; pro_unread?: boolean | null }[]
  >([]);
  const [isVerifiedPro, setIsVerifiedPro] = useState(false);
  const [proProfileCreatedAt, setProProfileCreatedAt] = useState<string | null>(null);
  const [hasVoicePin, setHasVoicePin] = useState<boolean | null>(null);
  const [pendingReviewNotices, setPendingReviewNotices] = useState<PendingReviewNotice[]>([]);
  const [platformAnnouncements, setPlatformAnnouncements] = useState<PlatformWhatsNewRow[]>([]);
  const [jobModerationNotices, setJobModerationNotices] = useState<
    Awaited<ReturnType<typeof fetchJobRequestModerationNotices>>
  >([]);
  const [proApplicationNotices, setProApplicationNotices] = useState<
    { id: string; decision: "approved" | "needs_info"; review_note: string | null; created_at: string }[]
  >([]);

  const refreshFeed = useCallback(async () => {
    if (!user?.id) {
      setClientBookings([]);
      setProBookings([]);
      setIsVerifiedPro(false);
      setProProfileCreatedAt(null);
      setHasVoicePin(null);
      setPendingReviewNotices([]);
      setPlatformAnnouncements([]);
      setJobModerationNotices([]);
      setProApplicationNotices([]);
      return;
    }
    const [clientRes, proRes, announcements, moderationNotices, applicationRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, created_at, client_unread")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      fetchMyProProfile<{ id: string; is_verified: boolean | null; created_at: string | null; updated_at: string | null }>("id, is_verified, created_at, updated_at"),
      fetchActivePlatformWhatsNewAnnouncements(),
      fetchJobRequestModerationNotices(user.id),
      supabase.from("pro_application_review_notices")
        .select("id, decision, review_note, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setClientBookings((clientRes.data ?? []) as typeof clientBookings);
    setPlatformAnnouncements(announcements);
    setJobModerationNotices(moderationNotices);
    setProApplicationNotices((applicationRes.data ?? []) as typeof proApplicationNotices);
    const proId = proRes.data?.id;
    const verified = proRes.data?.is_verified === true;
    setIsVerifiedPro(verified);
    setProProfileCreatedAt(proRes.data?.updated_at ?? proRes.data?.created_at ?? null);
    if (proId) {
      const { data: pinStatus } = await supabase.rpc("my_voice_pin_status");
      setHasVoicePin((pinStatus as { has_pin?: boolean } | null)?.has_pin === true);
    } else {
      setHasVoicePin(null);
    }
    if (proId && verified) {
      const { data: pb } = await supabase
        .from("bookings")
        .select("id, created_at, pro_unread")
        .eq("pro_profile_id", proId)
        .order("created_at", { ascending: false })
        .limit(30);
      setProBookings((pb ?? []) as typeof proBookings);
    } else {
      setProBookings([]);
    }
    const notices = await fetchPendingReviewNotices({
      userId: user.id,
      proProfileId: verified && proId ? proId : null,
      labels: {
        clientLine: (name) =>
          (t.dashboard.whatsNewReviewReceivedClient ?? "You received a review from {{name}}, leave yours to read it.").replace(
            "{{name}}",
            name,
          ),
        proLine: (name) =>
          (t.dashboard.whatsNewReviewReceivedPro ?? "{{name}} left a review, review them back to see it.").replace(
            "{{name}}",
            name,
          ),
        clientDueLine: (name) =>
          (t.dashboard.whatsNewReviewDueClient ?? "Your booking with {{name}} is complete, leave your review.").replace(
            "{{name}}",
            name,
          ),
        proDueLine: (name) =>
          (t.dashboard.whatsNewReviewDuePro ?? "Booking with {{name}} is complete, review them from your dashboard.").replace(
            "{{name}}",
            name,
          ),
      },
    });
    setPendingReviewNotices(notices);
  }, [
    user?.id,
    t.dashboard.whatsNewReviewReceivedClient,
    t.dashboard.whatsNewReviewReceivedPro,
    t.dashboard.whatsNewReviewDueClient,
    t.dashboard.whatsNewReviewDuePro,
  ]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshFeed();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshFeed]);

  useEffect(() => {
    const onReviewsChanged = () => void refreshFeed();
    window.addEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, onReviewsChanged);
  }, [refreshFeed]);

  useEffect(() => {
    const onWhatsNewChanged = () => void refreshFeed();
    window.addEventListener(WHATS_NEW_CHANGED_EVENT, onWhatsNewChanged);
    return () => window.removeEventListener(WHATS_NEW_CHANGED_EVENT, onWhatsNewChanged);
  }, [refreshFeed]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`pro-application-notices-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pro_application_review_notices", filter: `user_id=eq.${user.id}` },
        () => void refreshFeed(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, refreshFeed]);

  useEffect(() => {
    if (!user?.id || !isVerifiedPro) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      const { data } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).maybeSingle();
      if (cancelled || !data?.id) return;
      channel = supabase
        .channel(`whats-new-pro-bookings-${data.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `pro_profile_id=eq.${data.id}` },
          () => {
            void refreshFeed();
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id, isVerifiedPro, refreshFeed]);

  const items = useWhatsNewItems({
    clientBookings,
    proBookings,
    pendingReviewNotices,
    platformAnnouncements,
    jobModerationNotices,
    proApplicationNotices,
    proProfileCreatedAt,
    hasVoicePin,
    isVerifiedPro,
    isPlatformAdmin,
  });

  return <WhatsNewContext.Provider value={{ items, refresh: refreshFeed }}>{children}</WhatsNewContext.Provider>;
}

export function useWhatsNew() {
  return useContext(WhatsNewContext);
}
