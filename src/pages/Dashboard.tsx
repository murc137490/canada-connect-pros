import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { LiquidButton } from "@/components/ui/liquid-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Heart, Star, FileText, User, Loader2, Briefcase, MousePointer, TrendingUp, Clock, Phone, XCircle, CheckCircle, ShieldCheck, ArrowRight, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvailabilityCalendar from "@/components/pro/AvailabilityCalendar";
import ProScheduleEditor, {
  parseAvailabilityToWeekly,
  weeklyScheduleToAvailability,
  defaultWeeklySchedule,
  type WeeklyScheduleState,
} from "@/components/pro/ProScheduleEditor";
import type { UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import StarRating from "@/components/pro/StarRating";
import ProPagePhonePreview from "@/components/pro/ProPagePhonePreview";
import Dock, { type DockItemConfig } from "@/components/Dock";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { serviceCategories } from "@/data/services";
import { PRO_PAGE_COLOR_SCHEMES, getSchemeById, getSchemeIdFromColors } from "@/data/proPageColorSchemes";
import { SERVICE_TAG_OPTIONS } from "@/data/serviceTags";
import { useNotifications, shouldShowMockBookingNotification } from "@/contexts/NotificationContext";
import { distanceKm } from "@/lib/geocode";
import BookingProofUploadDialog from "@/components/BookingProofUploadDialog";
import BookingClaimDialog from "@/components/BookingClaimDialog";

type PendingPro = { id: string; user_id: string; business_name: string; created_at: string; subscription_tier?: string | null };
type AllPro = { id: string; business_name: string; is_verified: boolean; created_at: string; user_id: string; subscription_tier?: string | null };

type JobRequest = {
  id: string;
  description: string;
  category: string;
  city: string | null;
  province: string | null;
  budget_range: string | null;
  timing: string | null;
  status: string;
  created_at: string;
};
type JobQuote = {
  id: string;
  job_request_id: string;
  pro_profile_id: string;
  business_name?: string;
  price_cents: number | null;
  estimated_time: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

export default function Dashboard() {
  const { user, session } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { count: notificationCount, markSeen, setCount: setNotificationCount } = useNotifications();
  const [searchParams] = useSearchParams();
  const isAdmin = !!user && (user.email ?? "").toLowerCase().trim() === "premiereservicescontact@gmail.com";
  const [activeTab, setActiveTab] = useState("bookings");
  const [pendingPros, setPendingPros] = useState<PendingPro[]>([]);
  const [allPros, setAllPros] = useState<AllPro[]>([]);
  const [allProsLoading, setAllProsLoading] = useState(false);
  const [removingProId, setRemovingProId] = useState<string | null>(null);
  const [changeTierProId, setChangeTierProId] = useState<string | null>(null);
  const [changeTierValue, setChangeTierValue] = useState<string>("starter");
  const [updatingTierId, setUpdatingTierId] = useState<string | null>(null);
  const [proPrimaryPhotoByProId, setProPrimaryPhotoByProId] = useState<Record<string, string>>({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [declineProUserId, setDeclineProUserId] = useState<string | null>(null);
  const [declineProReason, setDeclineProReason] = useState("");
  const [declineProSubmitting, setDeclineProSubmitting] = useState(false);
  const [reviewProId, setReviewProId] = useState<string | null>(null);
  const [reviewProData, setReviewProData] = useState<{
    profile: Record<string, unknown> & { user_id: string; business_name: string; bio: string | null; location: string | null; years_experience: number | null; phone: string | null; website: string | null; availability: string | null; price_min: number | null; price_max: number | null; service_at_workspace_only: boolean | null; service_radius_km: number | null; created_at: string };
    services: { category_slug: string; service_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null }[];
    photos: { url: string; caption: string | null; is_primary: boolean }[];
  } | null>(null);
  const [reviewProLoading, setReviewProLoading] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null; birthday: string | null; address: string | null; avatar_url?: string | null } | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({ full_name: "", phone: "", birthday: "", address: "" });
  const [proProfile, setProProfile] = useState<{ id: string; business_name: string; availability: string | null; is_verified: boolean; price_min?: number | null; price_max?: number | null } | null>(null);
  const [proPrimaryPhotoUrl, setProPrimaryPhotoUrl] = useState<string | null>(null);
  const [proStats, setProStats] = useState<{ leads: number; clicks: number; rank: number | null; total: number | null; categorySlug: string | null; reviewCount: number }>({ leads: 0, clicks: 0, rank: null, total: null, categorySlug: null, reviewCount: 0 });
  const [proBookings, setProBookings] = useState<{
    id: string;
    created_at: string;
    preferred_date?: string | null;
    preferred_time?: string | null;
    status: string;
    client_id: string;
    decline_reason?: string | null;
  }[]>([]);
  const [clientProfiles, setClientProfiles] = useState<Record<string, { full_name: string | null; phone: string | null; address?: string | null; username?: string | null }>>({});
  const [proProfileLoading, setProProfileLoading] = useState(false);
  const [proofUploadOpen, setProofUploadOpen] = useState(false);
  const [proofUploadBookingId, setProofUploadBookingId] = useState<string | null>(null);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [approveBookingId, setApproveBookingId] = useState<string | null>(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [reviewClientBooking, setReviewClientBooking] = useState<{ bookingId: string; clientId: string } | null>(null);
  const [clientReviewRating, setClientReviewRating] = useState(0);
  const [clientReviewContent, setClientReviewContent] = useState("");
  const [clientReviewSubmitting, setClientReviewSubmitting] = useState(false);
  // Pro page aesthetic editing (template + colors) in dashboard
  const [proPageTemplate, setProPageTemplate] = useState<string>("classic");
  const [proPageColorSchemeId, setProPageColorSchemeId] = useState<string>("navyTeal");
  const [proPagePrimaryColor, setProPagePrimaryColor] = useState("#1e3a5f");
  const [proPageSecondaryColor, setProPageSecondaryColor] = useState("#0d9488");
  const [proPageAccentColor, setProPageAccentColor] = useState("#e0f2f1");
  const [proPageBackgroundColor, setProPageBackgroundColor] = useState("#f8fafc");
  const [proPageHeaderText, setProPageHeaderText] = useState("");
  const [proServiceTags, setProServiceTags] = useState<string[]>([]);
  const [savingProAesthetic, setSavingProAesthetic] = useState(false);
  const [proWeeklySchedule, setProWeeklySchedule] = useState<WeeklyScheduleState>(defaultWeeklySchedule());
  const [proUnavailableDates, setProUnavailableDates] = useState<UnavailableDatesMap>({});
  const [proAvailableDateOverrides, setProAvailableDateOverrides] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const subscriptionTier = ((proProfile as { subscription_tier?: string } | null)?.subscription_tier ?? "starter") as string;
  const canEditFeaturedProfileDesign = subscriptionTier === "growth" || subscriptionTier === "pro";
  const [reviewedClientIds, setReviewedClientIds] = useState<Set<string>>(new Set());
  const [clientBookings, setClientBookings] = useState<{ id: string; created_at: string; status: string; pro_profile_id: string; business_name?: string }[]>([]);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimBooking, setClaimBooking] = useState<{ id: string; pro_profile_id: string } | null>(null);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [jobQuotesByRequestId, setJobQuotesByRequestId] = useState<Record<string, JobQuote[]>>({});

  // Client: edit job requests in dashboard
  const [editJobRequestId, setEditJobRequestId] = useState<string | null>(null);
  const [editReqDescription, setEditReqDescription] = useState("");
  const [editReqCategory, setEditReqCategory] = useState("");
  const [editReqTiming, setEditReqTiming] = useState<string>("");
  const [editReqBudgetMin, setEditReqBudgetMin] = useState("");
  const [editReqBudgetMax, setEditReqBudgetMax] = useState("");
  const [editReqSubmitting, setEditReqSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [acceptQuoteId, setAcceptQuoteId] = useState<string | null>(null);
  const [declineQuoteId, setDeclineQuoteId] = useState<string | null>(null);
  // Pro: available jobs (open job_requests) for sidebar
  const [availableJobs, setAvailableJobs] = useState<(JobRequest & { latitude: number | null; longitude: number | null; distance_km?: number })[]>([]);
  const [selectedJobForQuote, setSelectedJobForQuote] = useState<JobRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteEstimatedTime, setQuoteEstimatedTime] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [sendingQuote, setSendingQuote] = useState(false);
  const [showMoreJobs, setShowMoreJobs] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  type ProServiceRow = { category_slug: string; service_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null };
  const [proServices, setProServices] = useState<ProServiceRow[]>([]);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceDialogEditing, setServiceDialogEditing] = useState<ProServiceRow | null>(null);
  const [startingPriceInput, setStartingPriceInput] = useState("");
  const [savingStartingPrice, setSavingStartingPrice] = useState(false);
  const [serviceFormCategory, setServiceFormCategory] = useState("");
  const [serviceFormService, setServiceFormService] = useState("");
  const [serviceFormPriceMin, setServiceFormPriceMin] = useState("");
  const [serviceFormPriceMax, setServiceFormPriceMax] = useState("");
  const [serviceFormDuration, setServiceFormDuration] = useState("");
  const [serviceFormDescription, setServiceFormDescription] = useState("");
  const [savingService, setSavingService] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const validTabs = ["account", "bookings", "favorites", "reviews", "invoices", "admin", "pro"];
    if (tab && validTabs.includes(tab)) {
      if (tab === "admin" && !isAdmin) return;
      if (tab === "pro" && !proProfile?.is_verified) return;
      setActiveTab(tab);
    }
  }, [searchParams, isAdmin, proProfile?.is_verified]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setAdminLoading(true);
    (async () => {
      const { data: list } = await supabase
        .from("pro_profiles")
        .select("id, user_id, business_name, created_at, subscription_tier, is_verified")
        .order("created_at", { ascending: false });
      const rows = (list ?? []) as {
        id: string;
        user_id: string;
        business_name: string;
        created_at: string;
        subscription_tier?: string | null;
        is_verified?: boolean | string | null;
      }[];
      // Some schemas store booleans as strings; normalize so admins can still see pending applications.
      const pending = rows.filter((p) => p.is_verified === false || String(p.is_verified).toLowerCase() === "false" || p.is_verified == null);
      setPendingPros(pending as PendingPro[]);
      setAdminLoading(false);
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setAllProsLoading(true);
    (async () => {
      const { data: list } = await supabase
        .from("pro_profiles")
        .select("id, business_name, is_verified, created_at, user_id, subscription_tier")
        .order("created_at", { ascending: false });
      const rows = (list ?? []) as {
        id: string;
        business_name: string;
        is_verified?: boolean | string | null;
        created_at: string;
        user_id: string;
        subscription_tier?: string | null;
      }[];
      const normalized = rows.map((p) => ({
        ...p,
        is_verified: p.is_verified === true || String(p.is_verified).toLowerCase() === "true",
      }));
      setAllPros(normalized as AllPro[]);
      setAllProsLoading(false);
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!proProfile?.is_verified) return;
    if (typeof window === "undefined") return;
    const key = "premiere-pro-onboarding-v1";
    if (localStorage.getItem(key) === "done") return;
    setShowOnboarding(true);
    setOnboardingStep(0);
  }, [proProfile?.is_verified]);

  const completeOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("premiere-pro-onboarding-v1", "done");
    }
    setShowOnboarding(false);
  };

  const nextOnboardingStep = () => {
    setOnboardingStep((prev) => {
      const next = prev + 1;
      if (next === 2) {
        setActiveTab("pro");
      }
      if (next >= 4) {
        completeOnboarding();
        return prev;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    const ids = Array.from(new Set([...pendingPros.map((p) => p.id), ...allPros.map((p) => p.id)]));
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("pro_photos")
        .select("pro_profile_id, url, is_primary")
        .in("pro_profile_id", ids)
        .order("is_primary", { ascending: false });
      const next: Record<string, string> = {};
      (data ?? []).forEach((row: { pro_profile_id: string; url: string; is_primary: boolean | null }) => {
        if (!next[row.pro_profile_id]) next[row.pro_profile_id] = row.url;
      });
      setProPrimaryPhotoByProId(next);
    })();
  }, [user, isAdmin, pendingPros, allPros]);

  useEffect(() => {
    if (!reviewProId) {
      setReviewProData(null);
      return;
    }
    setReviewProLoading(true);
    setReviewProData(null);
    (async () => {
      const [profileRes, servicesRes, photosRes] = await Promise.all([
        supabase.from("pro_profiles").select("*").eq("id", reviewProId).single(),
        supabase.from("pro_services").select("category_slug, service_slug, description, custom_price_min, custom_price_max").eq("pro_profile_id", reviewProId),
        supabase.from("pro_photos").select("url, caption, is_primary").eq("pro_profile_id", reviewProId).order("is_primary", { ascending: false }),
      ]);
      const profile = profileRes.data as (Record<string, unknown> & { user_id: string; business_name: string; bio: string | null; location: string | null; years_experience: number | null; phone: string | null; website: string | null; availability: string | null; price_min: number | null; price_max: number | null; service_at_workspace_only: boolean | null; service_radius_km: number | null; created_at: string }) | null;
      const services = (servicesRes.data ?? []) as { category_slug: string; service_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null }[];
      const photos = (photosRes.data ?? []) as { url: string; caption: string | null; is_primary: boolean }[];
      if (profile) setReviewProData({ profile, services, photos });
      setReviewProLoading(false);
    })();
  }, [reviewProId]);

  const handleAcceptPro = async (proUserId: string) => {
    if (!user) return;
    setAcceptingId(proUserId);
    try {
      const { error } = await supabase.rpc("accept_pro_by_admin", { p_user_id: proUserId });
      if (error) throw error;
      toast({ title: "Pro accepted. They now appear in search." });
      setPendingPros((prev) => prev.filter((p) => p.user_id !== proUserId));
    } catch (e) {
      toast({ title: "Failed to accept", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclinePro = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!declineProUserId) {
      toast({ title: "Missing pro id", description: "No pro was selected to decline.", variant: "destructive" });
      return;
    }
    if (!session?.access_token || !url) {
      toast({
        title: "Decline not configured",
        description: "VITE_SUPABASE_URL or session token is missing. Check .env and that you are logged in as admin.",
        variant: "destructive",
      });
      return;
    }
    setDeclineProSubmitting(true);
    try {
      const res = await fetch(`${url}/functions/v1/decline-pro`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ pro_user_id: declineProUserId, reason: declineProReason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      toast({ title: "Application declined. They were notified by email if configured." });
      setPendingPros((prev) => prev.filter((p) => p.user_id !== declineProUserId));
      setDeclineProUserId(null);
      setDeclineProReason("");
    } catch (e) {
      toast({ title: "Failed to decline", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeclineProSubmitting(false);
    }
  };

  const handleRemovePro = async (proProfileId: string) => {
    if (!user) return;
    setRemovingProId(proProfileId);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL;
      if (url && session?.access_token) {
        try {
          const res = await fetch(`${url}/functions/v1/admin-remove-pro`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ pro_profile_id: proProfileId }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            // HTTP error from Edge Function -> fall back to RPC
            const { error: rpcError } = await supabase.rpc("remove_pro_by_admin", { p_pro_profile_id: proProfileId });
            if (rpcError) throw new Error(data.error || res.statusText || rpcError.message);
            toast({
              title: "Pro removed (no email sent).",
              description: "Edge Function admin-remove-pro failed; removal was done via RPC.",
            });
          } else {
            toast({ title: "Pro removed. They were notified by email if configured." });
          }
        } catch (fetchErr) {
          // Network or fetch-level error -> fall back to RPC
          const { error: rpcError } = await supabase.rpc("remove_pro_by_admin", { p_pro_profile_id: proProfileId });
          if (rpcError) throw new Error((fetchErr as Error).message || rpcError.message);
          toast({
            title: "Pro removed (no email sent).",
            description: "Network error calling admin-remove-pro; removal was done via RPC.",
          });
        }
      } else {
        const { error } = await supabase.rpc("remove_pro_by_admin", { p_pro_profile_id: proProfileId });
        if (error) throw error;
        toast({ title: "Pro removed. They are now a normal account." });
      }
      setAllPros((prev) => prev.filter((p) => p.id !== proProfileId));
      setPendingPros((prev) => prev.filter((p) => p.id !== proProfileId));
    } catch (e) {
      toast({ title: "Failed to remove pro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRemovingProId(null);
    }
  };

  const handleChangeTier = async (proProfileId: string, newTier: string) => {
    if (!user || !isAdmin) return;
    setUpdatingTierId(proProfileId);
    try {
      const { error } = await supabase
        .from("pro_profiles")
        .update({ subscription_tier: newTier, updated_at: new Date().toISOString() })
        .eq("id", proProfileId);
      if (error) throw error;
      toast({ title: "Tier updated", description: `Plan set to ${newTier}.` });
      setAllPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: newTier } : p)));
      setPendingPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: newTier } : p)));
      setChangeTierProId(null);
      if (reviewProData?.profile && (reviewProData.profile as { id?: string }).id === proProfileId) {
        setReviewProData((d) => (d ? { ...d, profile: { ...d.profile, subscription_tier: newTier } } : d));
      }
    } catch (e) {
      toast({ title: "Failed to update tier", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUpdatingTierId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("full_name, phone, birthday, address, avatar_url").eq("user_id", user.id).single();
      if (data) {
        setProfile(data);
        setAccountForm({
          full_name: data.full_name ?? "",
          phone: data.phone ?? "",
          birthday: data.birthday ?? "",
          address: data.address ?? "",
        });
      }
    })();
  }, [user]);

  // Initialize pro page aesthetic form from loaded profile
  useEffect(() => {
    if (!proProfile) return;
    const p = proProfile as {
      page_template?: string;
      page_primary_color?: string;
      page_secondary_color?: string;
      page_accent_color?: string;
      page_background_color?: string;
      page_header_text?: string;
      service_tags?: string[] | null;
    };
    const template = p.page_template || "classic";
    setProPageTemplate(template === "bold" || template === "warm" || template === "minimal" ? "classic" : template);
    setProPageHeaderText(p.page_header_text ?? "");
    const schemeId = getSchemeIdFromColors(p.page_primary_color ?? null, p.page_secondary_color ?? null);
    setProPageColorSchemeId(schemeId || "navyTeal");
    if (p.page_primary_color) setProPagePrimaryColor(p.page_primary_color);
    if (p.page_secondary_color) setProPageSecondaryColor(p.page_secondary_color);
    if (p.page_accent_color) setProPageAccentColor(p.page_accent_color);
    if (p.page_background_color) setProPageBackgroundColor(p.page_background_color);
    if (!p.page_primary_color && !p.page_secondary_color) {
      const def = getSchemeById("navyTeal");
      if (def) {
        setProPagePrimaryColor(def.primary);
        setProPageSecondaryColor(def.secondary);
        setProPageAccentColor(def.accent);
        setProPageBackgroundColor(def.background);
      }
    }
    setProServiceTags(Array.isArray(p.service_tags) ? p.service_tags : []);
  }, [proProfile?.id]);

  const handleSaveSchedule = async () => {
    if (!proProfile) return;
    setSavingSchedule(true);
    try {
      const payload: Record<string, unknown> = {
        availability: weeklyScheduleToAvailability(proWeeklySchedule),
        unavailable_dates: Object.keys(proUnavailableDates).length ? proUnavailableDates : {},
        available_date_overrides: proAvailableDateOverrides,
      };
      const { error } = await supabase.from("pro_profiles").update(payload).eq("id", proProfile.id);
      if (error) throw error;
      toast({ title: t.dashboard.saved ?? "Saved", description: t.dashboard.scheduleSaved ?? "Schedule updated." });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveProAesthetic = async () => {
    if (!proProfile) return;
    setSavingProAesthetic(true);
    try {
      // Core fields (exist on older schemas) – required for "save color" to work
      const { error: coreError } = await supabase
        .from("pro_profiles")
        .update({
          page_primary_color: proPagePrimaryColor || null,
          page_secondary_color: proPageSecondaryColor || null,
          page_accent_color: proPageAccentColor || null,
          page_background_color: proPageBackgroundColor || null,
          page_template: null,
          page_header_text: null,
        })
        .eq("id", proProfile.id);
      if (coreError) throw coreError;

      // Newer columns (service_tags) – skip if schema doesn't have them yet
      const { error: extraError } = await supabase
        .from("pro_profiles")
        .update({
          service_tags: proServiceTags.length > 0 ? proServiceTags : null,
        })
        .eq("id", proProfile.id);
      if (extraError) {
        console.warn("Pro profile extra fields (tags) not saved – add columns if needed:", extraError.message);
      }

      toast({
        title: t.dashboard.saved ?? "Saved",
        description: t.dashboard.proAestheticSaved ?? "Your page style has been updated.",
      });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingProAesthetic(false);
    }
  };

  const openAddServiceDialog = () => {
    setServiceDialogEditing(null);
    setServiceFormCategory("");
    setServiceFormService("");
    setServiceFormPriceMin("");
    setServiceFormPriceMax("");
    setServiceFormDuration("");
    setServiceFormDescription("");
    setServiceDialogOpen(true);
  };

  const openEditServiceDialog = (row: ProServiceRow) => {
    setServiceDialogEditing(row);
    setServiceFormCategory(row.category_slug);
    setServiceFormService(row.service_slug);
    const existingPrice = row.custom_price_min != null ? row.custom_price_min : row.custom_price_max;
    setServiceFormPriceMin(existingPrice != null ? String(existingPrice) : "");
    setServiceFormPriceMax("");
    setServiceFormDuration("");
    setServiceFormDescription(row.description ?? "");
    setServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!proProfile || !serviceFormCategory || !serviceFormService) return;
    setSavingService(true);
    try {
      const description = [serviceFormDescription.trim(), serviceFormDuration.trim() ? `Duration: ${serviceFormDuration.trim()}` : ""].filter(Boolean).join("\n") || null;
      const price = serviceFormPriceMin.trim() ? parseInt(serviceFormPriceMin, 10) : null;
      if (serviceDialogEditing) {
        const { error } = await supabase
          .from("pro_services")
          .update({ description, custom_price_min: price, custom_price_max: price })
          .eq("pro_profile_id", proProfile.id)
          .eq("category_slug", serviceDialogEditing.category_slug)
          .eq("service_slug", serviceDialogEditing.service_slug);
        if (error) throw error;
        toast({ title: t.dashboard.saved ?? "Saved" });
      } else {
        const { error } = await supabase.from("pro_services").insert({
          pro_profile_id: proProfile.id,
          category_slug: serviceFormCategory,
          service_slug: serviceFormService,
          description,
          custom_price_min: price,
          custom_price_max: price,
        });
        if (error) throw error;
        toast({ title: t.dashboard.saved ?? "Saved" });
      }
      // Update list immediately so the saved price shows in live in My Services
      const savedPrice = price;
      const savedDescription = description;
      setProServices((prev) => {
        if (serviceDialogEditing) {
          const idx = prev.findIndex((s) => s.category_slug === serviceDialogEditing.category_slug && s.service_slug === serviceDialogEditing.service_slug);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], description: savedDescription, custom_price_min: savedPrice, custom_price_max: savedPrice };
            return next;
          }
        } else {
          return [...prev, { category_slug: serviceFormCategory, service_slug: serviceFormService, description: savedDescription, custom_price_min: savedPrice, custom_price_max: savedPrice }];
        }
        return prev;
      });
      setServiceDialogOpen(false);
      const { data } = await supabase.from("pro_services").select("category_slug, service_slug, description, custom_price_min, custom_price_max").eq("pro_profile_id", proProfile.id);
      if (data != null) setProServices(data as ProServiceRow[]);
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingService(false);
    }
  };

  const handleRemoveService = async (row: ProServiceRow) => {
    if (!proProfile) return;
    try {
      const { error } = await supabase
        .from("pro_services")
        .delete()
        .eq("pro_profile_id", proProfile.id)
        .eq("category_slug", row.category_slug)
        .eq("service_slug", row.service_slug);
      if (error) throw error;
      setProServices((prev) => prev.filter((s) => !(s.category_slug === row.category_slug && s.service_slug === row.service_slug)));
      toast({ title: t.dashboard.saved ?? "Saved" });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSaveStartingPrice = async () => {
    if (!proProfile) return;
    setSavingStartingPrice(true);
    try {
      const value = startingPriceInput.trim().replace(/[^0-9]/g, "");
      const price = value ? parseInt(value, 10) : null;
      const { error } = await supabase
        .from("pro_profiles")
        .update({ price_min: price, price_max: price })
        .eq("id", proProfile.id);
      if (error) throw error;
      setProProfile((prev) => (prev ? { ...prev, price_min: price ?? undefined, price_max: price ?? undefined } : null));
      setStartingPriceInput(price != null ? String(price) : "");
      toast({ title: t.dashboard.saved ?? "Saved" });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingStartingPrice(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: list } = await supabase
        .from("bookings")
        .select("id, created_at, status, pro_profile_id")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = (list || []) as { id: string; created_at: string; status: string; pro_profile_id: string }[];
      if (rows.length > 0) {
        const proIds = [...new Set(rows.map((b) => b.pro_profile_id))];
        const { data: pros } = await supabase.from("pro_profiles").select("id, business_name").in("id", proIds);
        const nameMap: Record<string, string> = {};
        (pros || []).forEach((p: { id: string; business_name: string }) => { nameMap[p.id] = p.business_name || ""; });
        setClientBookings(rows.map((r) => ({ ...r, business_name: nameMap[r.pro_profile_id] })));
      } else {
        setClientBookings([]);
      }
    })();
  }, [user]);

  // Client: fetch job requests (Make a Request) and their quotes
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: requests } = await supabase
        .from("job_requests")
        .select("id, description, category, city, province, budget_range, timing, status, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });
      const reqs = (requests || []) as JobRequest[];
      setJobRequests(reqs);
      if (reqs.length === 0) {
        setJobQuotesByRequestId({});
        return;
      }
      const reqIds = reqs.map((r) => r.id);
      const { data: quotes } = await supabase
        .from("job_quotes")
        .select("id, job_request_id, pro_profile_id, price_cents, estimated_time, message, status, created_at")
        .in("job_request_id", reqIds)
        .order("created_at", { ascending: false });
      const quoteList = (quotes || []) as (JobQuote & { pro_profile_id: string })[];
      const proIds = [...new Set(quoteList.map((q) => q.pro_profile_id))];
      const { data: pros } = await supabase.from("pro_profiles").select("id, business_name").in("id", proIds);
      const nameMap: Record<string, string> = {};
      (pros || []).forEach((p: { id: string; business_name: string }) => { nameMap[p.id] = p.business_name || ""; });
      const withNames = quoteList.map((q) => ({ ...q, business_name: nameMap[q.pro_profile_id] }));
      const byRequest: Record<string, JobQuote[]> = {};
      reqIds.forEach((id) => { byRequest[id] = []; });
      withNames.forEach((q) => {
        if (!byRequest[q.job_request_id]) byRequest[q.job_request_id] = [];
        byRequest[q.job_request_id].push(q);
      });
      setJobQuotesByRequestId(byRequest);
    })();
  }, [user]);

  // Mock notification: show 1 until client views booking tab (for demo; remove later)
  useEffect(() => {
    if (!user || proProfile?.is_verified) return;
    if (shouldShowMockBookingNotification()) setNotificationCount(1);
  }, [user, proProfile?.is_verified, setNotificationCount]);

  // Clear notification when user views booking tab
  useEffect(() => {
    if (activeTab === "bookings") markSeen();
  }, [activeTab, markSeen]);

  // Pro: fetch available jobs (open job_requests) and pro location for distance
  useEffect(() => {
    if (!user || !proProfile?.is_verified) return;
    (async () => {
      const { data: proRow } = await supabase
        .from("pro_profiles")
        .select("latitude, longitude, service_radius_km")
        .eq("id", proProfile.id)
        .single();
      const proLat = (proRow as { latitude?: number | null } | null)?.latitude ?? null;
      const proLng = (proRow as { longitude?: number | null } | null)?.longitude ?? null;
      const radiusKm = (proRow as { service_radius_km?: number | null } | null)?.service_radius_km ?? 50;

      const { data: jobs } = await supabase
        .from("job_requests")
        .select("id, description, category, city, province, budget_range, timing, status, created_at, latitude, longitude")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (jobs || []) as (JobRequest & { latitude: number | null; longitude: number | null })[];
      // Only show jobs created within the last 72 hours.
      const cutoffMs = Date.now() - 72 * 60 * 60 * 1000;
      const recent = list.filter((j) => {
        const t = new Date(j.created_at).getTime();
        return !Number.isNaN(t) && t >= cutoffMs;
      });
      const withDistanceRecent = recent
        .filter((j) => j.latitude != null && j.longitude != null && proLat != null && proLng != null)
        .map((j) => ({
          ...j,
          distance_km: distanceKm(proLat!, proLng!, j.latitude!, j.longitude!),
        }))
        .filter((j) => j.distance_km <= radiusKm)
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
      const noLocation = recent.filter((j) => j.latitude == null || j.longitude == null);
      setAvailableJobs([...withDistanceRecent, ...noLocation.map((j) => ({ ...j, distance_km: undefined }))]);
    })();
  }, [user, proProfile?.id, proProfile?.is_verified]);

  useEffect(() => {
    if (!user) return;
    setProProfileLoading(true);
    (async () => {
      const { data: proData, error: proError } = await supabase.from("pro_profiles").select("id, business_name, availability, is_verified, price_min, price_max, page_template, page_primary_color, page_secondary_color, page_accent_color, page_background_color, page_header_text, unavailable_dates, available_date_overrides").eq("user_id", user.id).single();
      let pro = proData as { id: string; business_name: string; availability: string | null; is_verified: boolean; price_min?: number | null; price_max?: number | null; unavailable_dates?: UnavailableDatesMap; available_date_overrides?: string[] } | null;
      if (proError && (proError.message?.includes("unavailable_dates") || proError.message?.includes("available_date_overrides"))) {
        const { data: fallback } = await supabase.from("pro_profiles").select("id, business_name, availability, is_verified, price_min, price_max, page_template, page_primary_color, page_secondary_color, page_accent_color, page_background_color, page_header_text").eq("user_id", user.id).single();
        pro = fallback as typeof pro;
      }
      if (!pro) {
        setProProfile(null);
        setProPrimaryPhotoUrl(null);
        setProProfileLoading(false);
        return;
      }
      setProProfile({ ...pro, is_verified: pro.is_verified === true });
      setProWeeklySchedule(parseAvailabilityToWeekly(pro.availability));
      setProUnavailableDates(pro.unavailable_dates && typeof pro.unavailable_dates === "object" ? pro.unavailable_dates : {});
      setProAvailableDateOverrides(Array.isArray(pro.available_date_overrides) ? pro.available_date_overrides : []);
      setProProfileLoading(false);
      const { data: primaryPhoto } = await supabase.from("pro_photos").select("url").eq("pro_profile_id", pro.id).eq("is_primary", true).limit(1).maybeSingle();
      setProPrimaryPhotoUrl(primaryPhoto?.url ?? null);
      const [bookingsRes, viewsRes, rankRes, ratingRes, bookingsListRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("pro_profile_id", pro.id).in("status", ["pending", "completed"]),
        supabase.from("pro_profile_views").select("id", { count: "exact", head: true }).eq("pro_profile_id", pro.id),
        supabase.rpc("get_pro_rank_in_category", { p_pro_profile_id: pro.id }),
        supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: pro.id }),
        supabase.from("bookings").select("id, created_at, preferred_date, preferred_time, status, client_id, decline_reason").eq("pro_profile_id", pro.id).order("created_at", { ascending: false }).limit(50),
      ]);
      const rankRow = rankRes.data?.[0] as { rank?: number; total?: number; category_slug?: string } | undefined;
      const ratingRow = ratingRes.data?.[0] as { review_count?: number } | undefined;
      setProStats({
        leads: bookingsRes.count ?? 0,
        clicks: viewsRes.error ? 0 : (viewsRes.count ?? 0),
        rank: rankRow?.rank ?? null,
        total: rankRow?.total ?? null,
        categorySlug: rankRow?.category_slug ?? null,
        reviewCount: Number(ratingRow?.review_count ?? 0),
      });
      const list = (bookingsListRes.data as { id: string; created_at: string; status: string; client_id: string; decline_reason?: string | null }[]) ?? [];
      setProBookings(list);
      const clientIds = [...new Set(list.map((b) => b.client_id).filter(Boolean))];
      if (clientIds.length > 0) {
        const [profilesRes, reviewsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, full_name, phone, address, username").in("user_id", clientIds),
          supabase.from("client_reviews").select("client_id").eq("pro_profile_id", pro.id),
        ]);
        const map: Record<string, { full_name: string | null; phone: string | null }> = {};
        (profilesRes.data || []).forEach((p: { user_id: string; full_name: string | null; phone: string | null; address?: string | null; username?: string | null }) => {
          map[p.user_id] = { full_name: p.full_name ?? null, phone: p.phone ?? null, address: p.address ?? null, username: p.username ?? null };
        });
        setClientProfiles(map);
        setReviewedClientIds(new Set(reviewsRes.error ? [] : (reviewsRes.data || []).map((r: { client_id: string }) => r.client_id)));
      } else {
        setClientProfiles({});
        setReviewedClientIds(new Set());
      }
    })();
  }, [user]);

  useEffect(() => {
    const p = proProfile as { price_min?: number | null } | null;
    setStartingPriceInput(p?.price_min != null ? String(p.price_min) : "");
  }, [proProfile?.id, (proProfile as { price_min?: number | null } | null)?.price_min]);

  useEffect(() => {
    if (!proProfile?.id || !proProfile?.is_verified) {
      setProServices([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("pro_services")
        .select("category_slug, service_slug, description, custom_price_min, custom_price_max")
        .eq("pro_profile_id", proProfile.id);
      setProServices((data as ProServiceRow[]) ?? []);
    })();
  }, [proProfile?.id, proProfile?.is_verified]);

  const handleSubmitClientReview = async () => {
    if (!proProfile || !reviewClientBooking || clientReviewRating < 1) return;
    setClientReviewSubmitting(true);
    try {
      const { error } = await supabase.from("client_reviews").upsert(
        {
          pro_profile_id: proProfile.id,
          client_id: reviewClientBooking.clientId,
          rating: clientReviewRating,
          content: clientReviewContent.trim() || null,
        },
        { onConflict: "pro_profile_id,client_id" }
      );
      if (error) throw error;
      toast({ title: t.dashboard.clientReviewSubmitted });
      setReviewedClientIds((prev) => new Set(prev).add(reviewClientBooking.clientId));
      setReviewClientBooking(null);
      setClientReviewRating(0);
      setClientReviewContent("");
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setClientReviewSubmitting(false);
    }
  };

  const handleDeclineBooking = async () => {
    if (!declineBookingId) return;
    setDeclineSubmitting(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "declined", decline_reason: declineReason.trim() || null })
        .eq("id", declineBookingId);
      if (error) throw error;
      const url = import.meta.env.VITE_SUPABASE_URL;
      if (url && session?.access_token) {
        try {
          await fetch(`${url}/functions/v1/send-booking-declined-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ booking_id: declineBookingId }),
          });
        } catch (_) {
          // Email is best-effort; don't fail the decline
        }
      }
      toast({ title: t.dashboard.declineSuccess ?? "Booking declined. Client was notified by email if configured." });
      setDeclineBookingId(null);
      setDeclineReason("");
      setProBookings((prev) => prev.map((b) => (b.id === declineBookingId ? { ...b, status: "declined" as const, decline_reason: declineReason.trim() || null } : b)));
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const handleApproveBooking = async (bookingId: string) => {
    setApproveBookingId(bookingId);
    setApproveSubmitting(true);
    try {
      const { error } = await supabase.from("bookings").update({ status: "completed" }).eq("id", bookingId);
      if (error) throw error;
      toast({ title: t.dashboard.approveSuccess ?? "Booking approved." });
      setProBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "completed" } : b)));
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setApproveSubmitting(false);
      setApproveBookingId(null);
    }
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAccountSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: accountForm.full_name.trim() || null,
        phone: accountForm.phone.trim() || null,
        birthday: accountForm.birthday.trim() || null,
        address: accountForm.address.trim() || null,
      }).eq("user_id", user.id);
      if (error) throw error;
      toast({ title: t.dashboard.accountSaved });
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setAccountSaving(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-page">
        <div className="container py-12 px-4 text-center">
          <p className="text-muted-foreground mb-4">{t.joinPros.loginMessage}</p>
          <Button asChild>
            <Link to="/auth?mode=login&redirect=/dashboard">{t.nav.logIn}</Link>
          </Button>
        </div>
        </div>
      </Layout>
    );
  }

  const displayJobs = showMoreJobs ? availableJobs : availableJobs.slice(0, 9);
  const hasMoreJobs = availableJobs.length > 9;

  const jobUpText = (createdAt?: string | null) => {
    if (!createdAt) return "";
    const t = new Date(createdAt).getTime();
    if (Number.isNaN(t)) return "";
    const diffMs = Date.now() - t;
    if (diffMs < 0) return "";
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    if (days >= 1) return `Up for ${days}d`;
    const safeHours = Math.max(1, hours);
    return `Up for ${safeHours}h`;
  };

  const handleSendQuote = async () => {
    if (!selectedJobForQuote || !proProfile) return;
    setSendingQuote(true);
    try {
      const { error } = await supabase.from("job_quotes").insert({
        job_request_id: selectedJobForQuote.id,
        pro_profile_id: proProfile.id,
        price_cents: quotePrice ? Math.round(parseFloat(quotePrice) * 100) : null,
        estimated_time: quoteEstimatedTime.trim() || null,
        message: quoteMessage.trim() || null,
        status: "pending",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Quote sent", description: "The customer will see your quote and can accept or decline." });
      setSelectedJobForQuote(null);
      setQuotePrice("");
      setQuoteEstimatedTime("");
      setQuoteMessage("");
    } catch (e) {
      toast({ title: "Failed to send quote", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSendingQuote(false);
    }
  };

  const handleSaveEditedJobRequest = async () => {
    if (!editJobRequestId) return;
    setEditReqSubmitting(true);
    try {
      const budgetMin = editReqBudgetMin.trim();
      const budgetMax = editReqBudgetMax.trim();
      const budget_range =
        budgetMin || budgetMax
          ? [budgetMin, budgetMax].filter(Boolean).join("-")
          : null;

      const payload = {
        description: editReqDescription.trim(),
        category: editReqCategory.trim() || "Other",
        budget_range,
        timing: editReqTiming.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("job_requests").update(payload).eq("id", editJobRequestId);
      if (error) throw error;

      setJobRequests((prev) =>
        prev.map((r) =>
          r.id === editJobRequestId
            ? {
                ...r,
                description: payload.description,
                category: payload.category,
                budget_range: payload.budget_range,
                timing: payload.timing,
              }
            : r
        )
      );

      toast({ title: t.dashboard.saved ?? "Saved", description: "Request updated." });
      setEditJobRequestId(null);
    } catch (e) {
      toast({ title: t.auth.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEditReqSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page dark:text-white flex flex-col items-center">
      <div className={`w-full py-8 md:py-12 px-4 md:px-6 ${proProfile?.is_verified ? "flex gap-0" : "max-w-4xl mx-auto"}`}>
      {proProfile?.is_verified && <div className="w-80 shrink-0 hidden lg:block" aria-hidden />}
      <div className={`${proProfile?.is_verified ? "flex-1 flex justify-center min-w-0" : "w-full"}`}>
      <div className={`w-full max-w-4xl container mx-auto`}>
        <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground dark:text-white mb-6 md:mb-8 text-center">
          {t.dashboard.title}
        </h1>

        {proProfile && !proProfile.is_verified && !proProfileLoading && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6">
            <p className="text-sm font-medium text-foreground">{t.dashboard.pendingProApproval ?? "Your pro application is pending approval."}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.dashboard.pendingProApprovalHint ?? "You will get access to the Pro file and pro features once an admin accepts your application."}</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 flex justify-center">
            <Dock
              items={([
                {
                  icon: <User size={18} />,
                  label: t.dashboard.myAccount,
                  onClick: () => setActiveTab("account"),
                  className: activeTab === "account" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                },
                ...(proProfile?.is_verified
                  ? [{
                      icon: <Briefcase size={18} />,
                      label: t.dashboard.proProfile,
                      onClick: () => setActiveTab("pro"),
                      className: activeTab === "pro" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    }]
                  : []),
                {
                  icon: <Calendar size={18} />,
                  label: t.dashboard.bookings,
                  onClick: () => setActiveTab("bookings"),
                  className: activeTab === "bookings" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                  badge: notificationCount,
                },
                {
                  icon: <Heart size={18} />,
                  label: t.dashboard.favorites,
                  onClick: () => setActiveTab("favorites"),
                  className: activeTab === "favorites" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                },
                {
                  icon: <Star size={18} />,
                  label: t.dashboard.reviews,
                  onClick: () => setActiveTab("reviews"),
                  className: activeTab === "reviews" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                },
                {
                  icon: <FileText size={18} />,
                  label: t.dashboard.invoices,
                  onClick: () => setActiveTab("invoices"),
                  className: activeTab === "invoices" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                },
                ...(isAdmin
                  ? [{
                      icon: <ShieldCheck size={18} />,
                      label: t.dashboard.admin,
                      onClick: () => setActiveTab("admin"),
                      className: activeTab === "admin" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    }]
                  : []),
              ] as DockItemConfig[])}
              magnification={52}
              baseItemSize={44}
              panelHeight={56}
              distance={160}
            />
          </div>

          {proProfile?.is_verified && (
            <TabsContent value="pro" className="space-y-4">
              {proProfileLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <Avatar className="h-20 w-20 border-2 border-border">
                        <AvatarImage src={proPrimaryPhotoUrl ?? profile?.avatar_url ?? undefined} alt={proProfile.business_name} />
                        <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                          {(profile?.full_name ?? proProfile.business_name).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-heading text-xl font-bold text-foreground">{proProfile.business_name}</h2>
                        <p className="text-muted-foreground">{profile?.full_name ?? ""}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{proStats.leads}</p>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><TrendingUp size={14} /> {t.dashboard.leads}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{proStats.clicks}</p>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><MousePointer size={14} /> {t.dashboard.clicks}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{proStats.reviewCount}</p>
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1"><Star size={14} /> {t.dashboard.reviewsCount ?? "Reviews"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {proStats.rank != null && proStats.total != null && proStats.total > 0
                            ? `${Math.round(100 - (Number(proStats.rank) / Number(proStats.total)) * 100)}%`
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">{t.dashboard.topPercent}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <h3 className="font-heading font-bold text-foreground mb-2">{t.dashboard.featuredProfileDesign ?? "Featured profile design"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.dashboard.proPageAestheticHint ?? "Change your template, background and colors. Clients will see these on your public page."}
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className={!canEditFeaturedProfileDesign ? "opacity-40 blur-[1px]" : ""}>
                          <p className="text-sm font-medium text-foreground mb-1">{t.createPro.colorSchemeLabel ?? "Color scheme"}</p>
                          <p className="text-xs text-muted-foreground mb-2">{t.createPro.colorSchemeHint ?? "Pick a palette. Preview updates immediately."} The primary color is used for the right sidebar (Starting price, Booking Guarantee, Availability) on your public page and the mock phone.</p>
                          <select
                            value={proPageColorSchemeId}
                            onChange={(e) => {
                              if (!canEditFeaturedProfileDesign) {
                                toast({
                                  title: (
                                    <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                                      {t.dashboard.upgradeToGrowthTier ?? "Upgrade to Growth tier?"}
                                    </span>
                                  ),
                                  description: t.dashboard.managePlanToast ?? "Manage your plan — Upgrade or downgrade anytime.",
                                  onClick: () => navigate("/pro-plans"),
                                });
                                return;
                              }
                              const id = e.target.value;
                              setProPageColorSchemeId(id);
                              const scheme = getSchemeById(id);
                              if (scheme) {
                                setProPagePrimaryColor(scheme.primary);
                                setProPageSecondaryColor(scheme.secondary);
                                setProPageAccentColor(scheme.accent);
                                setProPageBackgroundColor(scheme.background);
                              }
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                          >
                            {PRO_PAGE_COLOR_SCHEMES.map((scheme) => (
                              <option key={scheme.id} value={scheme.id}>
                                {(t.createPro as Record<string, string>)[`scheme${scheme.id.charAt(0).toUpperCase()}${scheme.id.slice(1)}`] ?? scheme.id}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">{t.dashboard.serviceTags ?? "Service tags"}</p>
                          <p className="text-xs text-muted-foreground mb-2">{t.dashboard.serviceTagsHint ?? "e.g. Emergency Repair, Commercial Work. Shown on your public page."}</p>
                          <div className="flex flex-wrap gap-2">
                            {SERVICE_TAG_OPTIONS.map((tag) => (
                              <label key={tag} className="inline-flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={proServiceTags.includes(tag)}
                                  onChange={(e) => {
                                    if (e.target.checked) setProServiceTags((prev) => [...prev, tag]);
                                    else setProServiceTags((prev) => prev.filter((t) => t !== tag));
                                  }}
                                  className="rounded border-input"
                                />
                                <span className="text-sm text-foreground">{tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={canEditFeaturedProfileDesign ? "space-y-3" : "space-y-3 pointer-events-none opacity-40 blur-[1px]"}>
                        <p className="text-sm font-medium text-foreground">{t.dashboard.proPagePreview ?? "Live preview"}</p>
                        <div className="content-panel rounded-xl p-4 text-sm space-y-3 bg-muted/40 dark:bg-muted/20 min-h-[480px] flex flex-col items-center justify-start">
                          <ProPagePhonePreview
                            template="classic"
                            primaryColor={proPagePrimaryColor}
                            secondaryColor={proPageSecondaryColor}
                            accentColor={proPageAccentColor}
                            backgroundColor={proPageBackgroundColor}
                            businessName={proProfile.business_name}
                            fullName={profile?.full_name ?? undefined}
                            ratingLabel={proStats.reviewCount > 0 ? String(Math.round((proStats.leads || 5) * 10) / 10) : "5.0"}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-center gap-2"
                            onClick={() => window.open(`/pros/${proProfile.id}`, "_blank")}
                          >
                            <ArrowRight size={14} /> {t.dashboard.viewPublicPage ?? "View full public page"}
                          </Button>
                          <Button
                            type="button"
                            onClick={handleSaveProAesthetic}
                            disabled={savingProAesthetic}
                            className="w-full gap-2 mt-2"
                          >
                            {savingProAesthetic && <Loader2 size={16} className="animate-spin" />}
                            {t.common.save ?? "Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <h3 className="font-heading font-bold text-foreground mb-2">{t.dashboard.myServices ?? "My Services"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.dashboard.addService ?? "Add service"}, {t.dashboard.editService ?? "Edit service"}, {t.dashboard.setPrice ?? "Set price"}, {t.dashboard.setDuration ?? "Set duration"}. {t.dashboard.serviceBundlesComingSoon ?? "Service bundles coming soon."}
                    </p>
                    <div className="mb-6 flex flex-wrap items-end gap-3">
                      <div className="min-w-[140px]">
                        <Label htmlFor="dashboard-starting-price" className="text-sm font-medium text-foreground">
                          {t.profile?.startingPrice ?? "Starting price"}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                          {t.dashboard.startingPriceHint ?? "Shown on your public page. Used for payment when no service price is set."}
                        </p>
                        <Input
                          id="dashboard-starting-price"
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 50"
                          value={startingPriceInput}
                          onChange={(e) => setStartingPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
                          className="max-w-[120px]"
                        />
                      </div>
                      <Button type="button" size="sm" onClick={handleSaveStartingPrice} disabled={savingStartingPrice} className="gap-2">
                        {savingStartingPrice && <Loader2 size={14} className="animate-spin" />}
                        {t.common.save ?? "Save"}
                      </Button>
                    </div>
                    {proServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground mb-4">{t.dashboard.noServicesYet ?? "No services added yet. Add a service to display on your profile."}</p>
                    ) : (
                      <ul className="space-y-3 mb-4">
                        {proServices.map((s) => {
                          const cat = serviceCategories.find((c) => c.slug === s.category_slug);
                          const categoryName = cat ? getCategoryName(cat, locale) : s.category_slug;
                          const serviceName = getServiceName(s.service_slug, locale, s.service_slug.replace(/-/g, " "));
                          const priceValue = s.custom_price_min != null ? s.custom_price_min : s.custom_price_max;
                          const priceStr = priceValue != null ? `$${priceValue}` : null;
                          return (
                            <li key={`${s.category_slug}-${s.service_slug}`} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border/50 text-sm">
                              <div>
                                <span className="font-medium text-foreground">{serviceName}</span>
                                <span className="text-muted-foreground mx-1">·</span>
                                <span className="text-muted-foreground">{categoryName}</span>
                                {priceStr && <span className="text-muted-foreground ml-1">({priceStr})</span>}
                              </div>
                              <div className="flex gap-2">
                                <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => openEditServiceDialog(s)}>
                                  <Pencil size={14} /> {t.dashboard.editService ?? "Edit"}
                                </Button>
                                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveService(s)}>
                                  {t.dashboard.removeService ?? "Remove"}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="gap-1" onClick={openAddServiceDialog}>
                        <Plus size={14} /> {t.dashboard.addService ?? "Add service"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toast({
                            title: (
                              <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                                {t.dashboard.upgradeToGrowthTier ?? "Upgrade to Growth tier?"}
                              </span>
                            ),
                            description: t.dashboard.managePlanToast ?? "Manage your plan — Upgrade or downgrade anytime.",
                            onClick: () => navigate("/pro-plans"),
                          })
                        }
                      >
                        {t.dashboard.createServiceBundle ?? "Create service bundle"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
            <DialogContent className="max-w-md bg-neutral-900 border-neutral-700 text-white [&_label]:text-white [&_input]:bg-neutral-800 [&_input]:border-neutral-600 [&_textarea]:bg-neutral-800 [&_textarea]:border-neutral-600 [&_select]:bg-neutral-800 [&_select]:border-neutral-600 [&_select]:text-white">
              <DialogHeader>
                <DialogTitle>{serviceDialogEditing ? (t.dashboard.editService ?? "Edit service") : (t.dashboard.addService ?? "Add service")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {serviceDialogEditing ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {getServiceName(serviceDialogEditing.service_slug, locale, serviceDialogEditing.service_slug)} · {(() => { const c = serviceCategories.find((x) => x.slug === serviceDialogEditing.category_slug); return c ? getCategoryName(c, locale) : serviceDialogEditing.category_slug; })()}
                    </p>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={serviceFormCategory}
                        onChange={(e) => { setServiceFormCategory(e.target.value); setServiceFormService(""); }}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                      >
                        <option value="">Select category</option>
                        {serviceCategories.map((c) => (
                          <option key={c.slug} value={c.slug}>{getCategoryName(c, locale)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Service</Label>
                      <select
                        value={serviceFormService}
                        onChange={(e) => setServiceFormService(e.target.value)}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                        disabled={!serviceFormCategory}
                      >
                        <option value="">Select service</option>
                        {serviceFormCategory && serviceCategories.find((c) => c.slug === serviceFormCategory)?.subcategories.flatMap((sc) => sc.services).map((s) => (
                          <option key={s.slug} value={s.slug}>{getServiceName(s.slug, locale, s.name)}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <Label>{t.dashboard.setPrice ?? "Price ($)"}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    placeholder="0"
                    value={serviceFormPriceMin}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                      setServiceFormPriceMin(digitsOnly);
                    }}
                    className="mt-1 text-white placeholder:text-white/60"
                  />
                </div>
                <div>
                  <Label>{t.dashboard.durationOptional ?? "Duration (optional)"}</Label>
                  <Input placeholder="e.g. 2 hours" value={serviceFormDuration} onChange={(e) => setServiceFormDuration(e.target.value)} className="mt-1 text-white placeholder:text-white/60" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Textarea placeholder="Brief description" value={serviceFormDescription} onChange={(e) => setServiceFormDescription(e.target.value)} rows={2} className="mt-1 resize-none text-white placeholder:text-white/60" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setServiceDialogOpen(false)} className="border-white text-white hover:bg-white/10 hover:text-white">
                  {t.common.cancel ?? "Cancel"}
                </Button>
                <Button onClick={handleSaveService} disabled={savingService || (!serviceDialogEditing && (!serviceFormCategory || !serviceFormService))} className="gap-2">
                  {savingService && <Loader2 size={14} className="animate-spin" />}
                  {t.common.save ?? "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!declineBookingId} onOpenChange={(open) => { if (!open) { setDeclineBookingId(null); setDeclineReason(""); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.dashboard.declineTitle ?? "Decline booking"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t.dashboard.declineMessage ?? "Optionally explain why (e.g. for the client email)."}</p>
              <Textarea
                placeholder={t.dashboard.declineReasonPlaceholder ?? "Reason or message to the client..."}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setDeclineBookingId(null); setDeclineReason(""); }}>{t.common.cancel ?? "Cancel"}</Button>
                <Button variant="destructive" onClick={handleDeclineBooking} disabled={declineSubmitting} className="gap-2">
                  {declineSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {t.dashboard.decline}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!reviewClientBooking} onOpenChange={(open) => { if (!open) { setReviewClientBooking(null); setClientReviewRating(0); setClientReviewContent(""); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.dashboard.reviewClientTitle}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t.dashboard.reviewClientDesc}</p>
              <div>
                <label className="text-sm font-medium block mb-1">{t.reviews.yourRating}</label>
                <StarRating rating={clientReviewRating} interactive onRate={setClientReviewRating} size={24} />
              </div>
              <Textarea
                placeholder={t.reviews.tellOthers}
                value={clientReviewContent}
                onChange={(e) => setClientReviewContent(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setReviewClientBooking(null); setClientReviewRating(0); setClientReviewContent(""); }}>{t.common.cancel}</Button>
                <Button onClick={handleSubmitClientReview} disabled={clientReviewSubmitting || clientReviewRating < 1} className="gap-2">
                  {clientReviewSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {t.reviews.submitReview}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <BookingProofUploadDialog
            open={proofUploadOpen}
            onOpenChange={(o) => {
              setProofUploadOpen(o);
              if (!o) setProofUploadBookingId(null);
            }}
            bookingId={proofUploadBookingId}
          />

          <BookingClaimDialog
            open={claimDialogOpen}
            onOpenChange={(o) => {
              setClaimDialogOpen(o);
              if (!o) setClaimBooking(null);
            }}
            bookingId={claimBooking?.id ?? null}
            proProfileId={claimBooking?.pro_profile_id ?? ""}
            accessToken={session?.access_token}
          />

          <TabsContent value="account" className="space-y-4 flex flex-col items-center">
            <form onSubmit={saveAccount} className="rounded-xl border bg-card p-6 md:p-8 space-y-4 max-w-lg w-full mx-auto">
              <div className="space-y-2">
                <Label htmlFor="acc-name">{t.dashboard.accountName}</Label>
                <Input id="acc-name" value={accountForm.full_name} onChange={(e) => setAccountForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Ryan Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-phone">{t.dashboard.accountPhone}</Label>
                <Input id="acc-phone" type="tel" value={accountForm.phone} onChange={(e) => setAccountForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-2">
                <Label>{t.dashboard.accountEmail}</Label>
                <Input value={user.email ?? ""} readOnly className="bg-muted" />
                <p className="text-xs text-muted-foreground">{t.dashboard.accountEmailHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-birthday">{t.dashboard.accountBirthday}</Label>
                <Input id="acc-birthday" type="date" value={accountForm.birthday} onChange={(e) => setAccountForm((p) => ({ ...p, birthday: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-address">{t.dashboard.accountAddress}</Label>
                <Input id="acc-address" value={accountForm.address} onChange={(e) => setAccountForm((p) => ({ ...p, address: e.target.value }))} placeholder="Street, city, province, postal code" />
              </div>
              <Button type="submit" disabled={accountSaving} className="gap-2">
                {accountSaving && <Loader2 size={16} className="animate-spin" />}
                {t.dashboard.saveAccount}
              </Button>
            </form>
            {proProfile?.is_verified && (
              <div className="rounded-xl border bg-card p-6 md:p-8 max-w-lg w-full mx-auto">
                <h3 className="font-heading font-bold text-foreground mb-1">{t.dashboard.myCurrentPlan}</h3>
                <p className="text-lg font-semibold text-primary mb-4">{t.plans?.starter ?? "Starter"}</p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  {(t.plans?.starterFeatures ?? []).map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={16} className="shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.plans?.bestFor ?? "Best for:"} {t.plans?.bestForStarter ?? "professionals testing the platform."}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {t.dashboard.subscriptionInfoStarter ??
                    "You’re on the Starter plan today. When you upgrade to Growth or Pro, your subscription will renew monthly from your upgrade date."}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/pro-plans">{t.dashboard.upgradeDowngradeLink}</Link>
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bookings" className="space-y-4">
            {proProfile?.is_verified ? (
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h3 className="font-heading font-bold text-foreground mb-1 flex items-center gap-2"><Clock size={18} /> {t.dashboard.schedule ?? "Schedule"} &amp; {t.dashboard.currentBookings}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.dashboard.scheduleBookingHint ?? "Manage your availability and see bookings on the calendar. Accept or deny requests below."}</p>
                <ProScheduleEditor
                  weekly={proWeeklySchedule}
                  unavailableDates={proUnavailableDates}
                  availableDateOverrides={proAvailableDateOverrides}
                  onWeeklyChange={setProWeeklySchedule}
                  onUnavailableDatesChange={setProUnavailableDates}
                  onAvailableDateOverridesChange={setProAvailableDateOverrides}
                  busyDates={proBookings.map((b) => (b.preferred_date ? String(b.preferred_date) : b.created_at.slice(0, 10))).filter(Boolean)}
                  availableDayColor={proPagePrimaryColor}
                  calendarSize="large"
                  bookingEvents={proBookings.map((b) => ({
                    dateStr: b.preferred_date ? String(b.preferred_date) : b.created_at.slice(0, 10),
                    label: clientProfiles[b.client_id]?.full_name ?? "Client",
                    time: b.preferred_time ? String(b.preferred_time).slice(0, 5) : b.created_at.slice(11, 16),
                    status: b.status,
                    address: clientProfiles[b.client_id]?.address ?? null,
                    email: clientProfiles[b.client_id]?.username ?? null,
                    phone: clientProfiles[b.client_id]?.phone ?? null,
                  }))}
                  restrictToCurrentMonth={((proProfile as { subscription_tier?: string } | null)?.subscription_tier ?? "starter") !== "growth" && ((proProfile as { subscription_tier?: string } | null)?.subscription_tier ?? "starter") !== "pro"}
                  onMonthChangeBlocked={() =>
                    toast({
                      title: (
                        <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                          {t.dashboard.upgradeToGrowthTier ?? "Upgrade to Growth tier?"}
                        </span>
                      ),
                      description: t.dashboard.managePlanToast ?? "Manage your plan — Upgrade or downgrade anytime.",
                      onClick: () => navigate("/pro-plans"),
                    })
                  }
                />
                <Button type="button" onClick={handleSaveSchedule} disabled={savingSchedule} className="mt-4 gap-2">
                  {savingSchedule && <Loader2 size={16} className="animate-spin" />}
                  {t.common.save ?? "Save"} {t.dashboard.schedule}
                </Button>
                <h4 className="font-heading font-semibold text-foreground mt-8 mb-3">{t.dashboard.bookingRequests ?? "Booking requests"}</h4>
                <p className="text-sm text-muted-foreground mb-4">{t.dashboard.acceptDenyHint ?? "Accept or deny each request below."}</p>
                {proBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.dashboard.emptyBookings}</p>
                ) : (
                  <ul className="space-y-3">
                    {proBookings.map((b) => {
                      const client = clientProfiles[b.client_id];
                      return (
                        <li key={b.id} className="py-3 border-b border-border/50 text-sm space-y-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span>{t.dashboard.requestedOn} {new Date(b.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                            <span className="capitalize text-muted-foreground">{b.status}</span>
                          </div>
                          {client && (client.phone || client.full_name) && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              {client.full_name && <span>{client.full_name}</span>}
                              {client.phone && (
                                <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                                  <Phone size={14} /> {client.phone}
                                </a>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {b.status === "pending" && (
                              <>
                                <Button type="button" size="sm" className="gap-1" onClick={() => handleApproveBooking(b.id)} disabled={approveSubmitting && approveBookingId === b.id}>
                                  {approveSubmitting && approveBookingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} {t.dashboard.approve}
                                </Button>
                                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setDeclineBookingId(b.id)}>
                                  <XCircle size={14} /> {t.dashboard.decline}
                                </Button>
                              </>
                            )}
                            {b.status === "declined" && b.decline_reason && (
                              <p className="text-xs text-muted-foreground mt-1">Reason: {b.decline_reason}</p>
                            )}
                            {proProfile && b.status === "completed" && !reviewedClientIds.has(b.client_id) && (
                              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setReviewClientBooking({ bookingId: b.id, clientId: b.client_id })}>
                                <Star size={14} /> {t.dashboard.reviewClient}
                              </Button>
                            )}
                            {proProfile && b.status === "completed" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                  setProofUploadBookingId(b.id);
                                  setProofUploadOpen(true);
                                }}
                              >
                                <FileText size={14} /> Upload proof
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {/* Client: Service requests (Make a Request) and quotes */}
                <div className="rounded-xl border bg-card p-6 md:p-8">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-heading font-bold text-foreground mb-1">Your service requests</h3>
                        <p className="text-sm text-muted-foreground">Requests you posted. Quotes from pros appear below.</p>
                      </div>
                      <Button asChild size="sm">
                        <Link to="/make-request">Make a request</Link>
                      </Button>
                    </div>
                    <ul className="space-y-6">
                      {jobRequests.map((req) => {
                        const quotes = jobQuotesByRequestId[req.id] ?? [];
                        return (
                          <li key={req.id} className="py-4 border-b border-border/50 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground">{req.description}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {req.category} · {req.city && req.province ? `${req.city}, ${req.province}` : "—"} · {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 shrink-0"
                                onClick={() => {
                                  setEditJobRequestId(req.id);
                                  setEditReqDescription(req.description ?? "");
                                  setEditReqCategory(req.category ?? "");
                                  setEditReqTiming(req.timing ?? "");
                                  const budget = req.budget_range ?? "";
                                  const parts = budget.includes("-") ? budget.split("-").map((x) => x.trim()) : [budget.trim()];
                                  setEditReqBudgetMin(parts[0] ?? "");
                                  setEditReqBudgetMax(parts.length > 1 ? (parts[1] ?? "") : "");
                                }}
                              >
                                <Pencil size={14} /> Edit
                              </Button>
                            </div>
                            {quotes.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-semibold text-foreground mb-2">Quotes received</p>
                                <ul className="space-y-2">
                                  {quotes.map((q) => (
                                    <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/40">
                                      <div>
                                        <span className="font-medium">{q.business_name || "Pro"}</span>
                                        {q.price_cents != null && <span className="ml-2">${(q.price_cents / 100).toFixed(0)}</span>}
                                        {q.estimated_time && <span className="text-muted-foreground text-sm ml-2">· {q.estimated_time}</span>}
                                        {q.message && <p className="text-sm text-muted-foreground mt-1">{q.message}</p>}
                                      </div>
                                      {q.status === "pending" && (
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={async () => {
                                            setAcceptQuoteId(q.id);
                                            const { error } = await supabase.from("job_quotes").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", q.id);
                                            if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                                            else toast({ title: "Quote accepted", description: "You can pay the pro to confirm." });
                                            setJobQuotesByRequestId((prev) => ({
                                              ...prev,
                                              [req.id]: (prev[req.id] ?? []).map((x) => x.id === q.id ? { ...x, status: "accepted" } : x),
                                            }));
                                            setAcceptQuoteId(null);
                                          }} disabled={!!acceptQuoteId}>
                                            {acceptQuoteId === q.id ? <Loader2 size={14} className="animate-spin" /> : null} Accept
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={async () => {
                                            setDeclineQuoteId(q.id);
                                            const { error } = await supabase.from("job_quotes").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", q.id);
                                            if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                                            else toast({ title: "Quote declined" });
                                            setJobQuotesByRequestId((prev) => ({
                                              ...prev,
                                              [req.id]: (prev[req.id] ?? []).map((x) => x.id === q.id ? { ...x, status: "declined" } : x),
                                            }));
                                            setDeclineQuoteId(null);
                                          }} disabled={!!declineQuoteId}>
                                            {declineQuoteId === q.id ? <Loader2 size={14} className="animate-spin" /> : null} Decline
                                          </Button>
                                        </div>
                                      )}
                                      {q.status === "accepted" && <span className="text-sm text-green-600 dark:text-green-400">Accepted</span>}
                                      {q.status === "declined" && <span className="text-sm text-muted-foreground">Declined</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {quotes.length === 0 && <p className="text-sm text-muted-foreground mt-2">No quotes yet. Professionals in your area will be notified.</p>}
                          </li>
                        );
                      })}
                    </ul>
                    {jobRequests.length === 0 && (
                      <p className="text-sm text-muted-foreground">No requests yet. Post a job to receive quotes from pros.</p>
                    )}
                  </div>
                {/* My bookings (existing pro bookings) */}
                {clientBookings.length > 0 ? (
                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <h3 className="font-heading font-bold text-foreground mb-4">{t.dashboard.myBookings ?? "My bookings"}</h3>
                    <ul className="space-y-3">
                      {clientBookings.map((b) => (
                        <li key={b.id} className="py-3 border-b border-border/50 text-sm flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium text-foreground">{b.business_name || t.common.proFallback}</span>
                            <span className="text-muted-foreground ml-2">· {new Date(b.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                            <span className="capitalize text-muted-foreground ml-2">({b.status})</span>
                          </div>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link to={`/pros/${b.pro_profile_id}`}>{t.dashboard.viewPro ?? "View pro"}</Link>
                            </Button>
                            {b.status === "completed" && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setClaimBooking({ id: b.id, pro_profile_id: b.pro_profile_id });
                                    setClaimDialogOpen(true);
                                  }}
                                >
                                  Help / Claim
                                </Button>
                                <Button asChild size="sm">
                                  <Link to={`/pros/${b.pro_profile_id}#reviews`}>{t.reviews.leaveReview}</Link>
                                </Button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : jobRequests.length === 0 ? (
                  <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
                    <Calendar size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="mb-4">{t.dashboard.emptyBookings}</p>
                    <Button asChild variant="outline">
                      <Link to="/services">{t.dashboard.browseServices}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
              <Heart size={40} className="mx-auto mb-3 opacity-50" />
              <p className="mb-4">{t.dashboard.emptyFavorites}</p>
              <Button asChild variant="outline">
                <Link to="/services">{t.dashboard.findPros}</Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
              <Star size={40} className="mx-auto mb-3 opacity-50" />
              <p className="mb-4">{t.dashboard.emptyReviews}</p>
            </div>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-50" />
              <p className="mb-4">{t.dashboard.emptyInvoices}</p>
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-4">
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h2 className="font-heading text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <ShieldCheck size={24} /> Accept pros
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Accept applications so pros appear in search. Only you (admin) can see this.
                </p>
                {adminLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
                ) : pendingPros.length === 0 ? (
                  <p className="text-muted-foreground">No pending pros right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {pendingPros.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={proPrimaryPhotoByProId[p.id]} alt={p.business_name} />
                            <AvatarFallback>{(p.business_name || "P").slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{p.business_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Applied {new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[280px]" title={p.user_id}>{p.user_id}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setReviewProId(p.id)}>
                            {t.dashboard.reviewApplication ?? "Review application"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setChangeTierProId(p.id); setChangeTierValue((p.subscription_tier ?? "starter").toLowerCase()); }} disabled={!!updatingTierId}>
                            {t.dashboard.changeTier ?? "Change tier"}
                          </Button>
                          <Button size="sm" onClick={() => handleAcceptPro(p.user_id)} disabled={acceptingId !== null}>
                            {acceptingId === p.user_id ? <Loader2 size={16} className="animate-spin" /> : null} {t.dashboard.approve}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeclineProUserId(p.user_id)} disabled={!!declineProUserId}>
                            {t.dashboard.decline}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border bg-card p-6 md:p-8 mt-6">
                <h2 className="font-heading text-lg font-bold text-foreground mb-4">All professionals</h2>
                <p className="text-muted-foreground text-sm mb-4">Every pro (verified and pending). Only visible to you as admin.</p>
                {allProsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>
                ) : allPros.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No professionals yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium text-foreground">Business</th>
                          <th className="text-left py-2 font-medium text-foreground">Status</th>
                          <th className="text-left py-2 font-medium text-foreground">Tier</th>
                          <th className="text-left py-2 font-medium text-foreground">Joined</th>
                          <th className="text-left py-2 font-medium text-muted-foreground font-mono text-xs">User ID</th>
                          <th className="text-left py-2 font-medium text-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allPros.map((p) => (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="py-2">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={proPrimaryPhotoByProId[p.id]} alt={p.business_name} />
                                  <AvatarFallback>{(p.business_name || "P").slice(0, 1).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <Link to={`/pros/${p.id}`} className="text-foreground font-medium hover:underline text-primary">
                                  {p.business_name}
                                </Link>
                              </div>
                            </td>
                            <td className="py-2">{p.is_verified ? <span className="text-green-600 dark:text-green-400">Verified</span> : <span className="text-amber-600 dark:text-amber-400">Pending</span>}</td>
                            <td className="py-2 text-muted-foreground capitalize">{(p.subscription_tier ?? "starter").toLowerCase()}</td>
                            <td className="py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                            <td className="py-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={p.user_id}>{p.user_id}</td>
                            <td className="py-2 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => { setChangeTierProId(p.id); setChangeTierValue((p.subscription_tier ?? "starter").toLowerCase()); }} disabled={updatingTierId !== null}>
                                {updatingTierId === p.id ? <Loader2 size={14} className="animate-spin shrink-0" /> : null}
                                {t.dashboard.changeTier ?? "Change tier"}
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1" onClick={() => handleRemovePro(p.id)} disabled={removingProId !== null}>
                                {removingProId === p.id && <Loader2 size={14} className="animate-spin shrink-0" />}
                                {removingProId === p.id ? (t.dashboard.removing ?? "Removing…") : (t.dashboard.removeAsPro ?? "Remove as pro")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>

          <Dialog open={!!declineProUserId} onOpenChange={(open) => { if (!open) { setDeclineProUserId(null); setDeclineProReason(""); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.dashboard.declineProTitle ?? "Decline pro application"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t.dashboard.declineProMessage ?? "Optionally give a reason. They will receive it by email (if email is configured)."}</p>
              <Textarea
                placeholder={t.dashboard.declineProReasonPlaceholder ?? "Reason or message to the applicant..."}
                value={declineProReason}
                onChange={(e) => setDeclineProReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setDeclineProUserId(null); setDeclineProReason(""); }}>{t.common.cancel ?? "Cancel"}</Button>
                <Button variant="destructive" onClick={handleDeclinePro} disabled={declineProSubmitting} className="gap-2">
                  {declineProSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {t.dashboard.decline}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!changeTierProId} onOpenChange={(open) => { if (!open) setChangeTierProId(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t.dashboard.changeTier ?? "Change tier"}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">
                {changeTierProId && allPros.find((x) => x.id === changeTierProId)?.business_name}
              </p>
              <div className="space-y-2">
                <Label>{t.dashboard.tier ?? "Tier"}</Label>
                <select
                  value={changeTierValue}
                  onChange={(e) => setChangeTierValue(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setChangeTierProId(null)}>{t.common.cancel ?? "Cancel"}</Button>
                <Button
                  onClick={() => changeTierProId && handleChangeTier(changeTierProId, changeTierValue)}
                  disabled={!changeTierProId || updatingTierId !== null}
                >
                  {updatingTierId === changeTierProId && <Loader2 size={14} className="animate-spin mr-2" />}
                  {t.dashboard.save ?? "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!reviewProId} onOpenChange={(open) => { if (!open) setReviewProId(null); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.dashboard.reviewApplication ?? "Review application"}</DialogTitle>
              </DialogHeader>
              {reviewProLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
              ) : reviewProData ? (
                <div className="space-y-6 text-sm">
                  {((reviewProData.profile as Record<string, unknown>).personal_photo_url || (reviewProData.profile as Record<string, unknown>).id_document_url || reviewProData.photos?.length > 0) && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">{t.dashboard.photosAndId ?? "ID, selfie & photos"}</h4>
                      <div className="flex flex-wrap gap-6">
                        {(reviewProData.profile as Record<string, unknown>).id_document_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.idPicture ?? "ID document"}</p>
                            <img src={(reviewProData.profile as Record<string, unknown>).id_document_url as string} alt="ID" className="rounded-lg border border-border max-h-64 w-48 object-contain bg-muted/30" />
                          </div>
                        )}
                        {(reviewProData.profile as Record<string, unknown>).personal_photo_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.selfiePicture ?? "Selfie"}</p>
                            <img src={(reviewProData.profile as Record<string, unknown>).personal_photo_url as string} alt="Selfie" className="rounded-lg border border-border max-h-64 w-48 object-cover" />
                          </div>
                        )}
                        {reviewProData.photos?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.beforeAfterPhotos ?? "Before/after photos"}</p>
                            <div className="flex flex-wrap gap-2">
                              {reviewProData.photos.map((ph, i) => (
                                <img key={i} src={ph.url} alt={ph.caption || "Photo"} className="w-24 h-24 rounded-lg object-cover border border-border" title={ph.caption || undefined} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {!(reviewProData.profile as Record<string, unknown>).id_document_url && !(reviewProData.profile as Record<string, unknown>).personal_photo_url && reviewProData.photos?.length === 0 && (
                        <p className="text-muted-foreground text-sm">{t.dashboard.noIdOrSelfie ?? "No ID, selfie or photos submitted."}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{t.dashboard.businessName ?? "Business name"}</h4>
                    <p className="text-muted-foreground">{reviewProData.profile.business_name}</p>
                  </div>
                  {reviewProData.profile.bio && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{t.dashboard.bio ?? "Bio"}</h4>
                      <p className="text-muted-foreground whitespace-pre-wrap">{reviewProData.profile.bio}</p>
                    </div>
                  )}
                  {reviewProData.profile.location && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{t.dashboard.location ?? "Location"}</h4>
                      <p className="text-muted-foreground">{reviewProData.profile.location}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {reviewProData.profile.years_experience != null && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.yearsExperience ?? "Years experience"}</h4>
                        <p className="text-muted-foreground">{reviewProData.profile.years_experience}</p>
                      </div>
                    )}
                    {reviewProData.profile.phone && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.phone ?? "Phone"}</h4>
                        <p className="text-muted-foreground">{reviewProData.profile.phone}</p>
                      </div>
                    )}
                    {reviewProData.profile.website && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.website ?? "Website"}</h4>
                        <a href={reviewProData.profile.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{reviewProData.profile.website}</a>
                      </div>
                    )}
                    {(reviewProData.profile.price_min != null || reviewProData.profile.price_max != null) && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.priceRange ?? "Price range"}</h4>
                        <p className="text-muted-foreground">
                          {reviewProData.profile.price_min != null && reviewProData.profile.price_max != null
                            ? `$${reviewProData.profile.price_min} – $${reviewProData.profile.price_max}`
                            : reviewProData.profile.price_min != null
                              ? `From $${reviewProData.profile.price_min}`
                              : `Up to $${reviewProData.profile.price_max}`}
                        </p>
                      </div>
                    )}
                    {reviewProData.profile.service_at_workspace_only != null && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.serviceAt ?? "Service at"}</h4>
                        <p className="text-muted-foreground">{reviewProData.profile.service_at_workspace_only ? (t.dashboard.workspaceOnly ?? "Workspace only") : (t.dashboard.travelsToClient ?? "Travels to client")}</p>
                      </div>
                    )}
                    {reviewProData.profile.service_radius_km != null && !reviewProData.profile.service_at_workspace_only && (
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">{t.dashboard.serviceRadius ?? "Service radius"}</h4>
                        <p className="text-muted-foreground">{reviewProData.profile.service_radius_km} km</p>
                      </div>
                    )}
                  </div>
                  {reviewProData.profile.availability && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{t.dashboard.availability ?? "Availability"}</h4>
                      <AvailabilityCalendar availability={reviewProData.profile.availability} />
                    </div>
                  )}
                  {reviewProData.services.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{t.dashboard.servicesOffered ?? "Services offered"}</h4>
                      <ul className="space-y-1.5">
                        {reviewProData.services.map((s, i) => {
                          const cat = serviceCategories.find((c) => c.slug === s.category_slug);
                          const catName = cat ? getCategoryName(cat, locale) : s.category_slug;
                          const sub = cat?.subcategories.flatMap((sc) => sc.services).find((sv) => sv.slug === s.service_slug);
                          const serviceName = sub?.name ?? s.service_slug;
                          return (
                            <li key={i} className="text-muted-foreground">
                              {catName} · {serviceName}
                              {(s.custom_price_min != null || s.custom_price_max != null) && (
                                <span className="ml-2">
                                  ({s.custom_price_min != null && s.custom_price_max != null ? `$${s.custom_price_min}–$${s.custom_price_max}` : s.custom_price_min != null ? `from $${s.custom_price_min}` : `up to $${s.custom_price_max}`})
                                </span>
                              )}
                              {s.description && <p className="text-xs mt-0.5 pl-2 border-l border-border">{s.description}</p>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Applied {new Date(reviewProData.profile.created_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</p>
                  <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => setReviewProId(null)}>{t.common.cancel ?? "Cancel"}</Button>
                    <Button variant="outline" onClick={() => { setChangeTierProId(reviewProId); setChangeTierValue(((reviewProData.profile as { subscription_tier?: string }).subscription_tier ?? "starter").toLowerCase()); }} disabled={!!updatingTierId}>
                      {t.dashboard.changeTier ?? "Change tier"}
                    </Button>
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { setDeclineProUserId(reviewProData.profile.user_id); setReviewProId(null); }}>{t.dashboard.decline}</Button>
                    <Button onClick={() => { handleAcceptPro(reviewProData.profile.user_id); setReviewProId(null); }} disabled={acceptingId !== null}>
                      {acceptingId === reviewProData.profile.user_id ? <Loader2 size={14} className="animate-spin" /> : null} {t.dashboard.approve}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground py-4">{t.dashboard.loadFailed ?? "Could not load application."}</p>
              )}
            </DialogContent>
          </Dialog>

        {user && !proProfile && !proProfileLoading && (
          <div className="mt-8 pt-6 border-t flex justify-center">
            <LiquidButton asChild variant="secondary" whiteUntilHover>
              <Link to="/create-pro-account">{t.joinPros.completeProfile}</Link>
            </LiquidButton>
          </div>
        )}
      </div>
      </div>

      {proProfile?.is_verified && (
        <aside className="w-80 shrink-0 hidden lg:block sticky top-24 self-start rounded-xl border bg-card p-4 max-h-[calc(100vh-8rem)] overflow-y-auto ml-4">
          <h3 className="font-heading font-bold text-foreground mb-3">Available jobs in your area</h3>
          {availableJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open requests right now. Check back later.</p>
          ) : (
            <ul className="space-y-3">
              {displayJobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-border/50 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-foreground line-clamp-2">{job.description}</p>
                        <p className="text-muted-foreground text-xs whitespace-nowrap shrink-0 mt-0.5">
                          {jobUpText(job.created_at)}
                        </p>
                      </div>
                  {job.distance_km != null && (
                    <p className="text-muted-foreground text-xs mt-1">~{Math.round(job.distance_km)} km away</p>
                  )}
                  {job.budget_range && (
                    <p className="text-muted-foreground text-xs">Budget: {job.budget_range.includes("-") ? job.budget_range.split("-").map((v) => `$${v.trim()}`).join(" – ") : `$${job.budget_range}`}</p>
                  )}
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSelectedJobForQuote(job)}>
                    View more & send quote
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {hasMoreJobs && (
            <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setShowMoreJobs((v) => !v)}>
              {showMoreJobs ? "Show less" : "View more available jobs"}
            </Button>
          )}
        </aside>
      )}
      </div>
      </div>

      <Dialog
        open={!!editJobRequestId}
        onOpenChange={(open) => {
          if (!open) setEditJobRequestId(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editReqDescription}
                onChange={(e) => setEditReqDescription(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editReqCategory} onChange={(e) => setEditReqCategory(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Budget min</Label>
                <Input type="number" min={0} step={10} value={editReqBudgetMin} onChange={(e) => setEditReqBudgetMin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Budget max</Label>
                <Input type="number" min={0} step={10} value={editReqBudgetMax} onChange={(e) => setEditReqBudgetMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Timing</Label>
              <Input value={editReqTiming} onChange={(e) => setEditReqTiming(e.target.value)} placeholder="asap / few_days / this_week / flexible" />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setEditJobRequestId(null)}>
              {t.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              onClick={handleSaveEditedJobRequest}
              disabled={editReqSubmitting || !editJobRequestId}
            >
              {editReqSubmitting && <Loader2 size={14} className="animate-spin mr-2" />}
              {t.dashboard?.save ?? "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedJobForQuote} onOpenChange={(open) => !open && setSelectedJobForQuote(null)}>
        <DialogContent className="max-w-md bg-neutral-900 border-neutral-700 text-white [&_label]:text-white [&>button]:text-white [&>button]:hover:text-white [&_input]:bg-neutral-800 [&_input]:border-neutral-600 [&_textarea]:bg-neutral-800 [&_textarea]:border-neutral-600">
          <DialogHeader>
            <DialogTitle className="text-white">Send a quote</DialogTitle>
          </DialogHeader>
          {selectedJobForQuote && (
            <div className="space-y-4 text-white">
              <p className="text-sm text-white">{selectedJobForQuote.description}</p>
              <p className="text-xs text-white/80">{selectedJobForQuote.category} · {selectedJobForQuote.city && selectedJobForQuote.province ? `${selectedJobForQuote.city}, ${selectedJobForQuote.province}` : "—"}</p>
              <div>
                <Label className="text-white">Price ($)</Label>
                <Input type="number" min={0} step={1} placeholder="e.g. 120" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} className="text-white placeholder:text-white/60" />
              </div>
              <div>
                <Label className="text-white">Estimated time</Label>
                <Input placeholder="e.g. Tomorrow, 2–3 hours" value={quoteEstimatedTime} onChange={(e) => setQuoteEstimatedTime(e.target.value)} className="text-white placeholder:text-white/60" />
              </div>
              <div>
                <Label className="text-white">Message</Label>
                <Textarea placeholder="Short note for the customer" value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} rows={3} className="text-white placeholder:text-white/60" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedJobForQuote(null)} className="border-white text-white hover:bg-white/10 hover:text-white">Cancel</Button>
                <Button onClick={handleSendQuote} disabled={sendingQuote}>
                  {sendingQuote && <Loader2 size={14} className="animate-spin mr-2" />}
                  Send quote
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
