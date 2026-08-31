import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from "react";
import { format } from "date-fns";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiquidButton } from "@/components/ui/liquid-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays,
  CalendarIcon,
  Heart,
  Star,
  FileText,
  User,
  Loader2,
  Briefcase,
  MousePointer,
  TrendingUp,
  Clock,
  Phone,
  XCircle,
  CheckCircle,
  ShieldCheck,
  Shield,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Gift,
  Send,
  X,
  Copy,
  Check,
  Wallet,
  ShieldAlert,
  BadgeCheck,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AvailabilityCalendar from "@/components/pro/AvailabilityCalendar";
import ProBookingRequestCard from "@/components/pro/ProBookingRequestCard";
import ProBookingRequestDetailDialog from "@/components/pro/ProBookingRequestDetailDialog";
import ClientBookingPayDialog from "@/components/ClientBookingPayDialog";
import DashboardReviewsPanel from "@/components/dashboard/DashboardReviewsPanel";
import { DashboardTour, DashboardTourHelpButton } from "@/components/dashboard/DashboardTour";
import {
  type DashTourSegment,
  isSegmentCompleted,
  segmentForTab,
} from "@/lib/dashboardTutorial";
import { buildBookingInvoiceSnapshotV2 } from "@/lib/bookingInvoiceSnapshot";
import ReviewForm from "@/components/pro/ReviewForm";

const ProProfileEditorDialog = lazy(() => import("@/components/pro/ProProfileEditorDialog"));
import ClientReviewPhotoPicker from "@/components/dashboard/ClientReviewPhotoPicker";
import ClickableProfileAvatar from "@/components/dashboard/ClickableProfileAvatar";
import { uploadProfileAvatar, syncProPrimaryPhotoFromAvatar } from "@/lib/uploadProfileAvatar";
import { uploadClientReviewPhotos, revokePhotoPreviewUrls } from "@/lib/clientReviewPhotos";
import { notifyReviewsChanged, REVIEWS_CHANGED_EVENT } from "@/lib/fetchPendingReviewNotices";
import { canSubmitClientReview, canSubmitProReview } from "@/lib/reviewGuards";
import WhatsNewMenu from "@/components/WhatsNewMenu";
import { useWhatsNew } from "@/contexts/WhatsNewContext";
import {
  contrastDialogContentClass,
  contrastDialogDescriptionClass,
  contrastDialogTitleClass,
} from "@/lib/dialogContrast";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { profileDefaultMode, type ServiceLocationMode } from "@/lib/serviceLocationMode";
import ProScheduleEditor, {
  parseAvailabilityToWeekly,
  weeklyScheduleToAvailability,
  defaultWeeklySchedule,
  type WeeklyScheduleState,
} from "@/components/pro/ProScheduleEditor";
import type { UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import StarRating from "@/components/pro/StarRating";
import ProPagePhonePreview from "@/components/pro/ProPagePhonePreview";
import ProPortfolioEditor from "@/components/pro/ProPortfolioEditor";
import Dock, { type DockItemConfig } from "@/components/Dock";

const dashboardProVerifiedCacheKey = (userId: string) => `dashboardProVerified:${userId}`;

function readDashboardProVerifiedCache(userId: string | undefined): boolean | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(dashboardProVerifiedCacheKey(userId));
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // ignore
  }
  return null;
}

function writeDashboardProVerifiedCache(userId: string, verified: boolean) {
  try {
    localStorage.setItem(dashboardProVerifiedCacheKey(userId), verified ? "true" : "false");
  } catch {
    // ignore
  }
}
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { serviceCategories } from "@/data/services";
import { PRO_PAGE_COLOR_SCHEMES, getSchemeById, getSchemeIdFromColors } from "@/data/proPageColorSchemes";
import { SERVICE_TAG_OPTIONS } from "@/data/serviceTags";
import { useNotifications } from "@/contexts/NotificationContext";
import { PRO_BOOKING_SELECT, useProBookingsRealtime, type ProBookingRealtimeRow } from "@/hooks/useProBookingsRealtime";
import { distanceKm, extractCanadianPostal, geocodePostalToLocation } from "@/lib/geocode";
import { formatCanadianPostal, normalizeCanadianPostal } from "@/lib/canadianPostal";
import {
  BROWSE_POSTAL_CHANGED_EVENT,
  clearBrowsePostalLocation,
  getBrowsePostalLocation,
  setBrowsePostalLocation,
} from "@/lib/browsePostalStorage";
import { purgeStaleJobRequests } from "@/lib/purgeStaleJobRequests";
import BookingProofUploadDialog from "@/components/BookingProofUploadDialog";
import BookingClaimDialog from "@/components/BookingClaimDialog";
import BookingInvoiceCard from "@/components/BookingInvoiceCard";
import TimingAndDateFields from "@/components/job-request/TimingAndDateFields";
import AddressInput, { hasGoogleAddressAutocomplete } from "@/components/AddressInput";
import { geocodeAddress } from "@/lib/geocode";
import { serviceModeNeedsWorkspaceAddress } from "@/lib/serviceWorkspaceLocation";
import { TIMING_OPTIONS } from "@/data/makeRequestForm";
import { snapBudgetToTen } from "@/lib/budgetTen";
import {
  CLIENT_BOOKING_ID_VERIFICATION_BUCKET,
  persistClientBookingIdVerificationOnProfile,
  assertClientBookingIdFile,
} from "@/lib/clientBookingIdVerification";
import { computeBookingInvoiceFromBaseCents } from "@/lib/bookingInvoiceAmounts";
import {
  customerRequestedExactSlot,
  disableDatesOutsideCustomerChoice,
  effectiveCustomerTimeBounds,
  formatCustomerExactSlotLine,
  parseScheduleDay,
  validateProChosenDay,
  validateProTimeWindow,
} from "@/lib/jobRequestProQuote";
import { createLocalDateTime, hydrateSchedulingFormFromRow, schedulingDbFieldsFromFormState } from "@/lib/jobRequestScheduling";
import {
  clientRequestLimitForTier,
  effectiveProTier,
  hasFullScheduleCalendarAccess,
  hasFeaturedPublicProfileLook,
  hasGrowthServiceExtras,
  isPaidSubscriptionPlanId,
  scheduleRollingWindowEndDateStr,
} from "@/lib/proTierFeatures";
import { formatProResponseDuration } from "@/lib/bookingResponseTime";
import { rpcAcknowledgeAllBookingNotifications } from "@/lib/bookingNotifications";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { isBirthdayAtLeastMinAge, maxBirthdayForMinAge } from "@/lib/birthday";
import { CANADIAN_POSTAL_PLACEHOLDER } from "@/lib/canadianPostal";
import { EM_DASH, HIDDEN_COUPON_MASK } from "@/lib/typography";
import { labelProService, catalogEnNameForProService } from "@/lib/proServiceLabel";
import { formatDurationFieldValue, formatDurationLabel, parseDurationDigits, stripLegacyDurationFromDescription } from "@/lib/durationMinutes";
import { formatBookingTimeRange } from "@/lib/bookingTimeRange";
import { referralInvite, type ReferralInvite } from "@/lib/referralInvite";
import { errorMessage } from "@/lib/errorMessage";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { getProPublicContactBlacklistReasons } from "@/lib/proPublicContactBlacklist";
import SquareBookingPayment from "@/components/SquareBookingPayment";
import ProProfileApprovalDiff from "@/components/admin/ProProfileApprovalDiff";
import AdminReviewPhoto from "@/components/admin/AdminReviewPhoto";
import { resolveStorageDisplayUrl } from "@/lib/resolveStorageUrl";
import {
  diffProProfileSnapshots,
  parseApprovalBaselineJson,
  snapshotFromProProfileRow,
  type ProProfileSnapshotDiff,
} from "@/lib/proProfileApprovalSnapshot";
import { splitBioAndLanguages } from "@/lib/parseBioLanguages";
import {
  PLAN_TIER_BORDER_CLASS,
  PLAN_TIER_CHECK_CLASS,
  PLAN_TIER_NAME_CLASS,
  planTierThemeClass,
} from "@/lib/planTierTheme";
import "@/components/ProPlansContent.css";

/** Hide browser number input spinners (up/down) on price fields. */
const INPUT_NO_NUMBER_SPIN =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const CLIENT_REQUEST_FETCH_LIMIT = 200;

/** Open job_requests shown to verified pros (newest first). */
const OPEN_LEADS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const JOB_REQUESTS_LEADS_SELECT_FULL =
  "id, description, category, city, province, postal_code, photo_urls, budget_range, timing, status, created_at, latitude, longitude, preferred_date, preferred_time_window, preferred_datetime, scheduling_mode, time_window_code, range_start_date, range_end_date, exact_time, window_time_start, window_time_end";

const JOB_REQUESTS_LEADS_SELECT_MINIMAL =
  "id, description, category, city, province, budget_range, timing, status, created_at, latitude, longitude";

/** Treats API/status quirks; coupon shows only for completed + unclaimed. */
function isReferralCouponUnlocked(invite: ReferralInvite): boolean {
  const st = String(invite.status ?? "").toLowerCase().trim();
  if (st !== "completed") return false;
  const ca = invite.claimed_at;
  return ca == null || (typeof ca === "string" && ca.trim() === "");
}

type PendingPro = { id: string; user_id: string; business_name: string; created_at: string; subscription_tier?: string | null };
type AllPro = {
  id: string;
  business_name: string;
  is_verified: boolean;
  created_at: string;
  user_id: string;
  subscription_tier?: string | null;
  referral_invite_panel_enabled?: boolean | null;
};

type RequestLimitItem = { id: string; created_at: string };

function requestMonthKey(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function lockedClientRequestIds<T extends RequestLimitItem>(items: T[], monthlyLimit: number | null) {
  if (monthlyLimit == null) return new Set<string>();

  const countsByMonth = new Map<string, number>();
  const lockedIds = new Set<string>();
  const oldestFirst = [...items].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
  });

  oldestFirst.forEach((item) => {
    const key = requestMonthKey(item.created_at);
    const count = (countsByMonth.get(key) ?? 0) + 1;
    countsByMonth.set(key, count);
    if (count > monthlyLimit) lockedIds.add(item.id);
  });

  return lockedIds;
}

function formatCanadianPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);

  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function parseBudgetRange(raw: string | null | undefined): { min: number | null; max: number | null } {
  const s = (raw ?? "").trim();
  if (!s) return { min: null, max: null };
  const parts = s.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { min: null, max: null };
  if (parts.length === 1) {
    const n = Number(parts[0]);
    return Number.isFinite(n) ? { min: n, max: n } : { min: null, max: null };
  }
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
  };
}

type JobRequest = {
  id: string;
  description: string;
  category: string;
  city: string | null;
  province: string | null;
  postal_code?: string | null;
  photo_urls?: string[] | null;
  budget_range: string | null;
  timing: string | null;
  preferred_date?: string | null;
  preferred_time_window?: string | null;
  preferred_datetime?: string | null;
  scheduling_mode?: string | null;
  time_window_code?: string | null;
  range_start_date?: string | null;
  range_end_date?: string | null;
  exact_time?: string | null;
  window_time_start?: string | null;
  window_time_end?: string | null;
  status: string;
  created_at: string;
};

type AvailableJobItem = JobRequest & {
  latitude: number | null;
  longitude: number | null;
  distance_km?: number;
  outside_service_radius?: boolean;
};

type JobQuote = {
  id: string;
  job_request_id: string;
  pro_profile_id: string;
  business_name?: string;
  price_cents: number | null;
  estimated_time: string | null;
  /** ISO date (yyyy-MM-dd) the pro proposes for the visit. */
  proposed_service_date?: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

/** If optional columns are missing, fall back to smaller selects. */
async function fetchJobRequestsForClient(userId: string) {
  const full =
    "id, description, category, city, province, budget_range, timing, preferred_date, preferred_time_window, preferred_datetime, scheduling_mode, time_window_code, range_start_date, range_end_date, exact_time, window_time_start, window_time_end, status, created_at";
  const withPreferred =
    "id, description, category, city, province, budget_range, timing, preferred_date, preferred_time_window, status, created_at";
  const base =
    "id, description, category, city, province, budget_range, timing, status, created_at";
  let res = await supabase
    .from("job_requests")
    .select(full)
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (res.error) {
    res = await supabase
      .from("job_requests")
      .select(withPreferred)
      .eq("client_id", userId)
      .order("created_at", { ascending: false });
  }
  if (res.error) {
    res = await supabase
      .from("job_requests")
      .select(base)
      .eq("client_id", userId)
      .order("created_at", { ascending: false });
  }
  return res;
}

export default function Dashboard() {
  const { user, session } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { count: notificationCount, refreshBookingNotificationCount, setCount: setNotificationCount } =
    useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("bookings");
  const [pendingPros, setPendingPros] = useState<PendingPro[]>([]);
  const [allPros, setAllPros] = useState<AllPro[]>([]);
  const [allProsLoading, setAllProsLoading] = useState(false);
  const [adminSubByUserId, setAdminSubByUserId] = useState<
    Record<string, { trial_ends_at: string | null; plan_id: string | null }>
  >({});
  const [adminSubsLoading, setAdminSubsLoading] = useState(false);
  const [updatingReferralPanelId, setUpdatingReferralPanelId] = useState<string | null>(null);
  const [removingProId, setRemovingProId] = useState<string | null>(null);
  const [updatingTierId, setUpdatingTierId] = useState<string | null>(null);
  const [reviewEnrollment, setReviewEnrollment] = useState<{
    sub: { plan_id: string; billing_start: string | null; trial_ends_at: string | null; updated_at: string | null } | null;
    payments: { amount_cents: number; currency: string; status: string; square_payment_id: string | null; created_at: string }[];
    paymentsError?: string | null;
  } | null>(null);
  const [proPrimaryPhotoByProId, setProPrimaryPhotoByProId] = useState<Record<string, string>>({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminPublicUserNumberByUserId, setAdminPublicUserNumberByUserId] = useState<Record<string, string>>({});
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
  const [reviewProfileDiffs, setReviewProfileDiffs] = useState<ProProfileSnapshotDiff[]>([]);
  const [reviewProfileLastEdited, setReviewProfileLastEdited] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    phone: string | null;
    birthday: string | null;
    email_language?: string | null;
    avatar_url?: string | null;
    postal_code?: string | null;
    address?: string | null;
    booking_id_verification_photo_path?: string | null;
    booking_id_verification_status?: string | null;
    is_platform_admin?: boolean | null;
  } | null>(null);
  const { isPlatformAdmin: isAdmin, ready: platformAdminReady, isEnvListedAdmin } = usePlatformAdmin();
  /** True only after profile sync - gates privileged data loads. */
  const isMonitorAdmin = isAdmin && platformAdminReady;
  /**
   * Immediate admin chrome for allowlisted emails so the dock never flashes
   * bookings / reviews / invoices / favorites before admin tools load.
   */
  const isAdminDashboardShell = isEnvListedAdmin || isMonitorAdmin;
  /** Force admin tab on first paint for allowlisted admins (avoids empty bookings flash). */
  const shellTab =
    isAdminDashboardShell && activeTab !== "account" && activeTab !== "admin" ? "admin" : activeTab;
  const { resolvedTheme } = useTheme();
  const previewSiteTheme = resolvedTheme === "dark" ? "dark" : "light";
  const { items: whatsNewItems, refresh: refreshWhatsNew } = useWhatsNew();
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    full_name: "",
    phone: "",
    postal_code: "",
    address: "",
    birthday: "",
    email_language: "en" as "en" | "fr",
  });
  /** Pro: main service category (editable in My account) */
  const [accountMainCategory, setAccountMainCategory] = useState("");
  /** Signed URL for private booking ID verification object (short-lived). */
  const [bookingIdVerificationPreviewUrl, setBookingIdVerificationPreviewUrl] = useState<string | null>(null);
  const [accountIdVerificationFile, setAccountIdVerificationFile] = useState<File | null>(null);
  const [accountIdVerificationSaving, setAccountIdVerificationSaving] = useState(false);
  const [bookingIdVerificationOpen, setBookingIdVerificationOpen] = useState(false);
  const [bookingCancelPolicy, setBookingCancelPolicy] = useState<"free" | "late_fee" | "no_cancel">("late_fee");
  const [bookingCancelFeePercent, setBookingCancelFeePercent] = useState<25 | 50 | 75>(50);
  const [bookingCancelPolicySaving, setBookingCancelPolicySaving] = useState(false);
  const [proProfile, setProProfile] = useState<{
    id: string;
    business_name: string;
    availability: string | null;
    is_verified: boolean;
    subscription_tier?: string | null;
    price_min?: number | null;
    price_max?: number | null;
    primary_category_slug?: string | null;
    referral_invite_panel_enabled?: boolean | null;
    square_location_id?: string | null;
    service_at_workspace_only?: boolean | null;
    offers_workspace?: boolean | null;
    offers_travel?: boolean | null;
    business_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    service_radius_km?: number | null;
  } | null>(null);
  const [proPrimaryPhotoUrl, setProPrimaryPhotoUrl] = useState<string | null>(null);
  const [proStats, setProStats] = useState<{ leads: number; clicks: number; rank: number | null; total: number | null; categorySlug: string | null; reviewCount: number }>({ leads: 0, clicks: 0, rank: null, total: null, categorySlug: null, reviewCount: 0 });
  const [proBookings, setProBookings] = useState<{
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
  }[]>([]);
  const [clientProfiles, setClientProfiles] = useState<
    Record<string, { full_name: string | null; phone: string | null; booking_id_verification_status?: string | null; booking_id_verification_photo_path?: string | null }>
  >({});
  const [clientIdVerificationUrls, setClientIdVerificationUrls] = useState<Record<string, string>>({});
  /** Start true so the dock waits for the first pro-profile fetch (avoids icon flash). */
  const [proProfileLoading, setProProfileLoading] = useState(true);
  /** Cached verified flag so returning pros can paint the full dock immediately. */
  const [cachedProVerified, setCachedProVerified] = useState<boolean | null>(() =>
    readDashboardProVerifiedCache(user?.id),
  );
  const [proProfileEditorOpen, setProProfileEditorOpen] = useState(false);
  const [proProfileRefreshKey, setProProfileRefreshKey] = useState(0);
  const [proofUploadOpen, setProofUploadOpen] = useState(false);
  const [proofUploadBookingId, setProofUploadBookingId] = useState<string | null>(null);
  const [declineBookingId, setDeclineBookingId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [approveBookingId, setApproveBookingId] = useState<string | null>(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [markCompleteBookingId, setMarkCompleteBookingId] = useState<string | null>(null);
  const [markCompleteSubmitting, setMarkCompleteSubmitting] = useState(false);
  const [reviewClientBooking, setReviewClientBooking] = useState<{ bookingId: string; clientId: string } | null>(null);
  const [reviewProForClientId, setReviewProForClientId] = useState<string | null>(null);
  const [clientReviewRating, setClientReviewRating] = useState(0);
  const [clientReviewContent, setClientReviewContent] = useState("");
  const [clientReviewConfirmOpen, setClientReviewConfirmOpen] = useState(false);
  const [clientReviewSubmitting, setClientReviewSubmitting] = useState(false);
  const [clientReviewPhotos, setClientReviewPhotos] = useState<File[]>([]);
  const [clientReviewPhotoPreviews, setClientReviewPhotoPreviews] = useState<string[]>([]);
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
  const [mobileDesignPreviewOpen, setMobileDesignPreviewOpen] = useState(false);
  const [mobileColorSchemeOpen, setMobileColorSchemeOpen] = useState(false);
  const [proWeeklySchedule, setProWeeklySchedule] = useState<WeeklyScheduleState>(defaultWeeklySchedule());
  const [proUnavailableDates, setProUnavailableDates] = useState<UnavailableDatesMap>({});
  const [proAvailableDateOverrides, setProAvailableDateOverrides] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingBlockedHours, setSavingBlockedHours] = useState(false);
  const [proBookingDetailId, setProBookingDetailId] = useState<string | null>(null);
  const [payBookingTarget, setPayBookingTarget] = useState<(typeof clientBookings)[number] | null>(null);
  const [payBookingSquareLoc, setPayBookingSquareLoc] = useState<string | null>(null);
  const [proSubscriptionPlanId, setProSubscriptionPlanId] = useState<string | null>(null);

  const subscriptionTierNormalized = useMemo(
    () =>
      effectiveProTier(
        (proProfile as { subscription_tier?: string } | null)?.subscription_tier,
        proSubscriptionPlanId
      ),
    [proProfile, proSubscriptionPlanId]
  );

  const showProReviewSection = Boolean(
    proProfile?.is_verified && subscriptionTierNormalized && subscriptionTierNormalized !== "hold",
  );

  const mobilePreviewInitials = useMemo(() => {
    const name = (proProfile?.business_name ?? profile?.full_name ?? "?").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase() || "??";
  }, [proProfile?.business_name, profile?.full_name]);

  const mobilePreviewRatingLabel = useMemo(
    () => (proStats.reviewCount > 0 ? String(Math.round((proStats.leads || 5) * 10) / 10) : "5.0"),
    [proStats.reviewCount, proStats.leads]
  );
  /** Subservices list for the pro?s single main category (add service dialog). */
  const addServiceSelectOptions = useMemo(() => {
    const sl = proProfile?.primary_category_slug?.trim();
    if (!sl) return [];
    const cat = serviceCategories.find((c) => c.slug === sl);
    return cat?.subcategories.flatMap((sc) => sc.services) ?? [];
  }, [proProfile?.primary_category_slug]);
  const canEditFeaturedProfileDesign = hasFeaturedPublicProfileLook(subscriptionTierNormalized);
  const currentPlanTheme = planTierThemeClass(subscriptionTierNormalized);
  const [reviewedClientIds, setReviewedClientIds] = useState<Set<string>>(new Set());
  const [reviewedProIds, setReviewedProIds] = useState<Set<string>>(new Set());
  const [clientBookings, setClientBookings] = useState<
    {
      id: string;
      created_at: string;
      status: string;
      pro_profile_id: string;
      business_name?: string;
      pro_service_at_workspace_only?: boolean | null;
      pro_business_address?: string | null;
      responded_at?: string | null;
      auto_reply_snapshot?: string | null;
      service_category_slug?: string | null;
      service_slug?: string | null;
      client_renews_annually?: boolean | null;
      renewal_anchor_date?: string | null;
      renewal_interval_months_snapshot?: number | null;
      client_unread?: boolean | null;
      preferred_date?: string | null;
      preferred_time?: string | null;
      service_duration_minutes?: number | null;
      invoice_snapshot?: unknown;
      public_booking_code?: string | null;
    }[]
  >([]);
  const [bookingPaymentsById, setBookingPaymentsById] = useState<
    Record<string, { amount_cents: number; currency: string; square_payment_id: string | null; status: string }>
  >({});
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimBooking, setClaimBooking] = useState<{
    id: string;
    pro_profile_id: string;
    statusCode: string;
  } | null>(null);
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([]);
  const [jobQuotesByRequestId, setJobQuotesByRequestId] = useState<Record<string, JobQuote[]>>({});

  // Client: edit job requests in dashboard
  const [editJobRequestId, setEditJobRequestId] = useState<string | null>(null);
  const [editReqDescription, setEditReqDescription] = useState("");
  const [editReqCategory, setEditReqCategory] = useState("");
  const [editReqTiming, setEditReqTiming] = useState<string>("");
  const [editReqBudgetMin, setEditReqBudgetMin] = useState("");
  const [editReqBudgetMax, setEditReqBudgetMax] = useState("");
  const [editReqPreferredDate, setEditReqPreferredDate] = useState<Date | undefined>(undefined);
  const [editReqTimeWindow, setEditReqTimeWindow] = useState("");
  const [editReqAvailabilityMode, setEditReqAvailabilityMode] = useState<"range" | "specific_day" | "exact">("specific_day");
  const [editReqRangeStartDate, setEditReqRangeStartDate] = useState<Date | undefined>(undefined);
  const [editReqRangeEndDate, setEditReqRangeEndDate] = useState<Date | undefined>(undefined);
  const [editReqStartHour, setEditReqStartHour] = useState("");
  const [editReqEndHour, setEditReqEndHour] = useState("");
  const [editReqExactTime, setEditReqExactTime] = useState("");
  const [editReqSubmitting, setEditReqSubmitting] = useState(false);
  const [deletingJobRequestId, setDeletingJobRequestId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [referralEmail, setReferralEmail] = useState("");
  const [referralInvites, setReferralInvites] = useState<ReferralInvite[]>([]);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralClaiming, setReferralClaiming] = useState(false);
  const [referralDismissDialogOpen, setReferralDismissDialogOpen] = useState(false);
  const [referralTokenJustCopied, setReferralTokenJustCopied] = useState(false);
  const [adminProMemberFilter, setAdminProMemberFilter] = useState("");
  const [acceptQuoteId, setAcceptQuoteId] = useState<string | null>(null);
  const [declineQuoteId, setDeclineQuoteId] = useState<string | null>(null);
  const [quotePaymentTarget, setQuotePaymentTarget] = useState<{ requestId: string; quote: JobQuote } | null>(null);
  const [quoteProSquareLoc, setQuoteProSquareLoc] = useState<string | null>(null);
  const [squareConnectLoading, setSquareConnectLoading] = useState(false);
  const [quotePaymentError, setQuotePaymentError] = useState<string | null>(null);
  // Pro: available jobs (open job_requests) for sidebar
  const [availableJobs, setAvailableJobs] = useState<AvailableJobItem[]>([]);
  const [availableJobsNoCoordsBanner, setAvailableJobsNoCoordsBanner] = useState(false);
  const [browsePostalTick, setBrowsePostalTick] = useState(0);

  useEffect(() => {
    const onBrowsePostal = () => setBrowsePostalTick((n) => n + 1);
    window.addEventListener(BROWSE_POSTAL_CHANGED_EVENT, onBrowsePostal);
    return () => window.removeEventListener(BROWSE_POSTAL_CHANGED_EVENT, onBrowsePostal);
  }, []);
  const [selectedJobForQuote, setSelectedJobForQuote] = useState<JobRequest | null>(null);
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteEstimatedTime, setQuoteEstimatedTime] = useState("");
  const [quoteEstimatedDate, setQuoteEstimatedDate] = useState<Date | undefined>(undefined);
  const [quoteEstimatedHours, setQuoteEstimatedHours] = useState("");
  const [quoteTimeFrom, setQuoteTimeFrom] = useState("");
  const [quoteTimeTo, setQuoteTimeTo] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [sendingQuote, setSendingQuote] = useState(false);
  const [showMoreJobs, setShowMoreJobs] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  type ProServiceRow = {
    category_slug: string;
    service_slug: string;
    description: string | null;
    display_name: string | null;
    duration_minutes: number | null;
    custom_price_min: number | null;
    custom_price_max: number | null;
    auto_reply_message?: string | null;
    renewal_interval_months?: number | null;
    location_mode?: string | null;
    workspace_address?: string | null;
    workspace_latitude?: number | null;
    workspace_longitude?: number | null;
    cancel_policy?: string | null;
    cancel_fee_type?: string | null;
    cancel_fee_percent?: number | null;
    cancel_fee_cents?: number | null;
  };
  const [proServices, setProServices] = useState<ProServiceRow[]>([]);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceDialogEditing, setServiceDialogEditing] = useState<ProServiceRow | null>(null);
  const [startingPriceInput, setStartingPriceInput] = useState("");
  const [savingStartingPrice, setSavingStartingPrice] = useState(false);
  const [serviceFormService, setServiceFormService] = useState("");
  const [serviceFormPriceMin, setServiceFormPriceMin] = useState("");
  const [serviceFormPriceMax, setServiceFormPriceMax] = useState("");
  const [serviceFormDurationMins, setServiceFormDurationMins] = useState<number | null>(null);
  const [serviceFormDescription, setServiceFormDescription] = useState("");
  const [serviceFormDisplayName, setServiceFormDisplayName] = useState("");
  const [serviceFormAutoReply, setServiceFormAutoReply] = useState("");
  const [serviceFormRenewalMonths, setServiceFormRenewalMonths] = useState("");
  const [serviceFormLocationMode, setServiceFormLocationMode] = useState<ServiceLocationMode>("travel");
  const [serviceFormWorkspaceAddress, setServiceFormWorkspaceAddress] = useState("");
  const [serviceFormWorkspaceLat, setServiceFormWorkspaceLat] = useState<number | null>(null);
  const [serviceFormWorkspaceLng, setServiceFormWorkspaceLng] = useState<number | null>(null);
  /** free = no fee; late_fee = fee if <24h; no_cancel = full charge */
  const [serviceFormCancelPolicy, setServiceFormCancelPolicy] = useState<"free" | "late_fee" | "no_cancel">("late_fee");
  const [serviceFormCancelFeeType, setServiceFormCancelFeeType] = useState<"percent" | "fixed">("fixed");
  const [serviceFormCancelFeePercent, setServiceFormCancelFeePercent] = useState<25 | 50 | 75>(50);
  /** Dollars (not cents) for the fixed late-cancel fee input. */
  const [serviceFormCancelFeeDollars, setServiceFormCancelFeeDollars] = useState("");
  const [savingService, setSavingService] = useState(false);
  const [savedPros, setSavedPros] = useState<{ id: string; business_name: string; photoUrl: string | null }[]>([]);
  const [savedProsLoading, setSavedProsLoading] = useState(false);
  type ServiceBundleRow = { id: string; name: string; items: { category_slug: string; service_slug: string }[] };
  const [serviceBundles, setServiceBundles] = useState<ServiceBundleRow[]>([]);
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [bundleFormName, setBundleFormName] = useState("");
  const [bundleFormKeys, setBundleFormKeys] = useState<string[]>([]);
  const [savingBundle, setSavingBundle] = useState(false);
  const [dashTourOpen, setDashTourOpen] = useState(false);
  const [dashTourSegment, setDashTourSegment] = useState<DashTourSegment | null>(null);
  const [dashTourTick, setDashTourTick] = useState(0);
  const dashTourSessionSkip = useRef(new Set<DashTourSegment>());

  const setDashboardTab = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openDashTour = useCallback((segment: DashTourSegment, opts?: { force?: boolean }) => {
    if (!user?.id) return;
    if (!opts?.force && isSegmentCompleted(user.id, segment)) return;
    if (!opts?.force && dashTourSessionSkip.current.has(segment)) return;
    setDashTourSegment(segment);
    setDashTourOpen(true);
  }, [user?.id]);

  const replayDashTour = useCallback(
    (segment: DashTourSegment) => {
      dashTourSessionSkip.current.delete(segment);
      openDashTour(segment, { force: true });
    },
    [openDashTour],
  );

  /** Auto-start incomplete segment for pros; honor ?tour=1 from Help page. */
  useEffect(() => {
    if (!user?.id || isAdminDashboardShell || !proProfile) return;
    const segment = segmentForTab(shellTab);
    if (!segment) return;
    if (segment !== "account" && !proProfile.is_verified) return;

    const force = searchParams.get("tour") === "1";
    if (force) {
      dashTourSessionSkip.current.delete(segment);
      const t = window.setTimeout(() => {
        setDashTourSegment(segment);
        setDashTourOpen(true);
      }, 450);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("tour");
          return next;
        },
        { replace: true },
      );
      return () => window.clearTimeout(t);
    }

    if (isSegmentCompleted(user.id, segment)) return;
    if (dashTourSessionSkip.current.has(segment)) return;
    const t = window.setTimeout(() => {
      setDashTourSegment(segment);
      setDashTourOpen(true);
    }, 650);
    return () => window.clearTimeout(t);
  }, [
    user?.id,
    shellTab,
    proProfile,
    isAdminDashboardShell,
    searchParams,
    setSearchParams,
  ]);

  /** Dismiss stale booking badges as soon as the dashboard opens (not only on Bookings tab). */
  useEffect(() => {
    if (!user?.id || isMonitorAdmin) return;
    if (!platformAdminReady && isPlatformAdminEmail(user.email)) return;
    let cancelled = false;
    setNotificationCount(0);
    void (async () => {
      await rpcAcknowledgeAllBookingNotifications();
      if (cancelled) return;
      setClientBookings((prev) => prev.map((x) => ({ ...x, client_unread: false })));
      setProBookings((prev) => prev.map((x) => ({ ...x, pro_unread: false })));
      refreshBookingNotificationCount();
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isMonitorAdmin, platformAdminReady, user?.email, refreshBookingNotificationCount, setNotificationCount]);

  useEffect(() => {
    if (isAdminDashboardShell) {
      const tab = searchParams.get("tab");
      if (tab === "account" || tab === "admin") {
        setActiveTab(tab);
        return;
      }
      setDashboardTab("admin");
      return;
    }
    const tab = searchParams.get("tab");
    const validTabs = ["account", "bookings", "favorites", "reviews", "invoices", "admin", "pro"];
    if (!tab || !validTabs.includes(tab)) return;
    if (tab === "admin") {
      if (!platformAdminReady) return;
      if (!isAdmin) return;
    }
    if (tab === "pro" && !proProfile?.is_verified) return;
    setActiveTab(tab);
  }, [searchParams, isAdmin, isAdminDashboardShell, platformAdminReady, proProfile?.is_verified, setDashboardTab]);

  useEffect(() => {
    if (searchParams.get("tab") !== "bookings") return;
    if (window.location.hash !== "#received-quotes") return;
    const t = window.setTimeout(() => {
      document.getElementById("received-quotes")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [searchParams, jobRequests.length, proProfile?.is_verified]);

  /** Wait for pro profile (or a cached verified flag) before painting the client dock. */
  const dashboardDockReady =
    isAdminDashboardShell || !proProfileLoading || cachedProVerified !== null;
  const showProDockIcon = proProfileLoading
    ? cachedProVerified === true
    : proProfile?.is_verified === true;

  const dashboardDockItems = useMemo((): DockItemConfig[] => {
    if (isAdminDashboardShell) {
      return [
        {
          id: "admin",
          icon: <Shield size={20} />,
          label: t.dashboard.admin ?? "Admin",
          onClick: () => setDashboardTab("admin"),
          className: shellTab === "admin" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
        },
        {
          id: "admin-job-requests",
          icon: <Briefcase size={20} />,
          label: t.dashboard.adminJobRequestsNav ?? "Job requests",
          onClick: () => navigate("/admin/job-requests"),
          className: "",
        },
        {
          id: "account",
          icon: <User size={20} />,
          label: t.dashboard.myAccount,
          onClick: () => setDashboardTab("account"),
          className: shellTab === "account" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
        },
      ];
    }
    return [
      {
        id: "account",
        icon: <User size={20} />,
        label: t.dashboard.myAccount,
        onClick: () => setDashboardTab("account"),
        className: activeTab === "account" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      },
      ...(showProDockIcon
        ? [
            {
              id: "pro",
              icon: <Briefcase size={20} />,
              label: t.dashboard.proProfile,
              onClick: () => setDashboardTab("pro"),
              className: activeTab === "pro" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
            },
          ]
        : []),
      {
        id: "bookings",
        icon: <CalendarDays size={20} />,
        label: t.dashboard.bookings,
        onClick: () => setDashboardTab("bookings"),
        className: activeTab === "bookings" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
        badge: notificationCount,
      },
      {
        id: "favorites",
        icon: <Heart size={20} />,
        label: t.dashboard.favorites,
        onClick: () => setDashboardTab("favorites"),
        className: activeTab === "favorites" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      },
      {
        id: "reviews",
        icon: <Star size={20} />,
        label: t.dashboard.reviews,
        onClick: () => setDashboardTab("reviews"),
        className: activeTab === "reviews" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      },
      {
        id: "invoices",
        icon: <FileText size={20} />,
        label: t.dashboard.invoices,
        onClick: () => setDashboardTab("invoices"),
        className: activeTab === "invoices" ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
      },
    ];
  }, [
    isAdminDashboardShell,
    activeTab,
    shellTab,
    t.dashboard,
    setDashboardTab,
    showProDockIcon,
    notificationCount,
    navigate,
  ]);

  useEffect(() => {
    const pid = quotePaymentTarget?.quote.pro_profile_id;
    if (!pid) {
      setQuoteProSquareLoc(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("pro_profiles").select("square_location_id").eq("id", pid).maybeSingle();
      if (cancelled) return;
      const loc = (data as { square_location_id?: string } | null)?.square_location_id;
      setQuoteProSquareLoc(typeof loc === "string" && loc.trim() ? loc.trim() : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [quotePaymentTarget]);

  /** Keep browse geo in sync when profile or account postal changes (updates job distances). */
  useEffect(() => {
    if (!user?.id) return;
    const raw = accountForm.postal_code.trim() || profile?.postal_code?.trim() || "";
    const p = normalizeCanadianPostal(raw);
    if (p.replace(/\s/g, "").length < 6) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const geo = await geocodePostalToLocation(p);
        if (cancelled || !geo) return;
        setBrowsePostalLocation({
          postal: p,
          lat: geo.lat,
          lng: geo.lng,
          city: geo.city,
          province: geo.province,
        });
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user?.id, profile?.postal_code, accountForm.postal_code]);

  useEffect(() => {
    const c = searchParams.get("square_connected");
    const e = searchParams.get("square_error");
    if (!c && !e) return;
    if (c) {
      toast({
        title: t.dashboard.squareConnectedToast,
        description: t.dashboard.squareConnectedToastDesc,
      });
    }
    if (e) {
      toast({
        title: t.dashboard.squareOAuthErrorToast,
        description: decodeURIComponent(e).slice(0, 400),
        variant: "destructive",
      });
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("square_connected");
        next.delete("square_error");
        return next;
      },
      { replace: true }
    );
    if (user && c) {
      void (async () => {
        const { data } = await supabase
          .from("pro_profiles")
          .select("square_location_id")
          .eq("user_id", user.id)
          .maybeSingle();
        const loc = (data as { square_location_id?: string } | null)?.square_location_id;
        setProProfile((prev) =>
          prev ? { ...prev, square_location_id: typeof loc === "string" && loc.trim() ? loc.trim() : null } : null
        );
      })();
    }
  }, [searchParams, setSearchParams, toast, t, user]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    setAdminLoading(true);
    (async () => {
      let list: Record<string, unknown>[] | null = null;
      let qError: Error | null = null;

      const full = await supabase
        .from("pro_profiles")
        .select("id, user_id, business_name, created_at, subscription_tier, is_verified")
        .order("created_at", { ascending: false });
      const tierMissing =
        full.error &&
        `${full.error.message ?? ""} ${(full.error as { details?: string }).details ?? ""}`.toLowerCase().includes("subscription_tier");
      if (tierMissing) {
        const fb = await supabase
          .from("pro_profiles")
          .select("id, user_id, business_name, created_at, is_verified")
          .order("created_at", { ascending: false });
        list = fb.data as Record<string, unknown>[] | null;
        qError = fb.error as Error | null;
      } else {
        list = full.data as Record<string, unknown>[] | null;
        qError = full.error as Error | null;
      }

      if (qError) {
        toast({
          title: "Could not load pros (admin)",
          description: `${qError.message}. If the DB is missing subscription_tier, run: alter table public.pro_profiles add column if not exists subscription_tier text default 'starter';`,
          variant: "destructive",
        });
        setPendingPros([]);
        setAdminLoading(false);
        return;
      }

      const rows = (list ?? []) as {
        id: string;
        user_id: string;
        business_name: string;
        created_at: string;
        subscription_tier?: string | null;
        is_verified?: boolean | string | null;
      }[];
      const pending = rows.filter((p) => p.is_verified === false || String(p.is_verified).toLowerCase() === "false" || p.is_verified == null);
      setPendingPros(pending as PendingPro[]);
      setAdminLoading(false);
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const ids = [...new Set([...pendingPros.map((p) => p.user_id), ...allPros.map((p) => p.user_id)])];
    if (ids.length === 0) {
      setAdminPublicUserNumberByUserId({});
      return;
    }
    (async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, public_user_number").in("user_id", ids);
      if (error) {
        console.warn("admin profiles public_user_number:", error.message);
        return;
      }
      const next: Record<string, string> = {};
      (data ?? []).forEach((row: { user_id: string; public_user_number: string | null }) => {
        if (row.public_user_number) next[row.user_id] = row.public_user_number;
      });
      setAdminPublicUserNumberByUserId(next);
    })();
  }, [user, isAdmin, pendingPros, allPros]);

  const loadAllPros = useCallback(async () => {
    if (!user || !isAdmin) return;
    setAllProsLoading(true);
    const SELECT_ATTEMPTS = [
      "id, business_name, is_verified, created_at, user_id, subscription_tier, referral_invite_panel_enabled",
      "id, business_name, is_verified, created_at, user_id, subscription_tier",
      "id, business_name, is_verified, created_at, user_id, referral_invite_panel_enabled",
      "id, business_name, is_verified, created_at, user_id",
    ] as const;

    let list: Record<string, unknown>[] | null = null;
    let qError: Error | null = null;

    for (const select of SELECT_ATTEMPTS) {
      const res = await supabase.from("pro_profiles").select(select).order("created_at", { ascending: false });
      if (!res.error) {
        list = res.data as Record<string, unknown>[] | null;
        qError = null;
        break;
      }
      qError = res.error as Error;
    }

    if (qError) {
      toast({
        title: t.dashboard.adminAllProsRefreshError ?? "Could not load all professionals",
        description: `${qError.message}. Check RLS or run pending SQL migrations for pro_profiles.`,
        variant: "destructive",
      });
      setAllPros([]);
      setAllProsLoading(false);
      return;
    }

    const rows = (list ?? []) as {
      id: string;
      business_name: string;
      is_verified?: boolean | string | null;
      created_at: string;
      user_id: string;
      subscription_tier?: string | null;
      referral_invite_panel_enabled?: boolean | null;
    }[];
    const normalized = rows.map((p) => ({
      ...p,
      subscription_tier: (p.subscription_tier ?? "hold") as string,
      is_verified: p.is_verified === true || String(p.is_verified).toLowerCase() === "true",
      referral_invite_panel_enabled: p.referral_invite_panel_enabled,
    }));
    setAllPros(normalized as AllPro[]);
    setAllProsLoading(false);
  }, [user, isAdmin, toast, t.dashboard.adminAllProsRefreshError]);

  useEffect(() => {
    void loadAllPros();
  }, [loadAllPros]);

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

  const handleSquareConnect = useCallback(async () => {
    if (!proProfile?.id || !session?.access_token) return;
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
    if (!base) {
      toast({
        title: t.dashboard.squareOAuthErrorToast,
        description: "VITE_SUPABASE_URL is not set.",
        variant: "destructive",
      });
      return;
    }
    setSquareConnectLoading(true);
    try {
      const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/square-oauth-start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anon ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pro_profile_id: proProfile.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { authorize_url?: string; details?: string; error?: string };
      if (!res.ok) {
        toast({
          title: t.dashboard.squareOAuthErrorToast,
          description: data.details ?? data.error ?? res.statusText,
          variant: "destructive",
        });
        return;
      }
      if (typeof data.authorize_url === "string" && data.authorize_url.startsWith("http")) {
        window.location.href = data.authorize_url;
      } else {
        toast({
          title: t.dashboard.squareOAuthErrorToast,
          description: "Invalid authorize URL from server.",
          variant: "destructive",
        });
      }
    } finally {
      setSquareConnectLoading(false);
    }
  }, [proProfile?.id, session?.access_token, toast, t.dashboard]);

  const handleSquareDisconnect = useCallback(async () => {
    if (!proProfile?.id || !session?.access_token) return;
    const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
    const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
    if (!base) return;
    setSquareConnectLoading(true);
    try {
      const res = await fetch(`${base.replace(/\/+$/, "")}/functions/v1/square-oauth-disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anon ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pro_profile_id: proProfile.id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          title: t.dashboard.squareOAuthErrorToast,
          description: data.error ?? res.statusText,
          variant: "destructive",
        });
        return;
      }
      setProProfile((prev) => (prev ? { ...prev, square_location_id: null } : null));
      toast({
        title: t.dashboard.squareDisconnectToast,
        description: t.dashboard.squareDisconnectToastDesc,
      });
    } finally {
      setSquareConnectLoading(false);
    }
  }, [proProfile?.id, session?.access_token, toast, t.dashboard]);

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
    if (!user || !isAdmin) return;
    const ids = [...new Set([...allPros.map((p) => p.user_id), ...pendingPros.map((p) => p.user_id)])];
    if (ids.length === 0) {
      setAdminSubByUserId({});
      setAdminSubsLoading(false);
      return;
    }
    let cancelled = false;
    setAdminSubsLoading(true);
    void (async () => {
      const { data, error } = await supabase.from("pro_subscriptions").select("user_id, trial_ends_at, plan_id").in("user_id", ids);
      if (cancelled) return;
      if (error) {
        setAdminSubByUserId({});
        setAdminSubsLoading(false);
        toast({
          title: "Could not load pro subscriptions (admin)",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      const next: Record<string, { trial_ends_at: string | null; plan_id: string | null }> = {};
      (data ?? []).forEach((row: { user_id: string; trial_ends_at: string | null; plan_id: string | null }) => {
        next[row.user_id] = { trial_ends_at: row.trial_ends_at, plan_id: row.plan_id };
      });
      setAdminSubByUserId(next);
      setAdminSubsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin, allPros, pendingPros, toast]);

  useEffect(() => {
    if (!reviewProId) {
      setReviewProData(null);
      setReviewEnrollment(null);
      setReviewProfileDiffs([]);
      setReviewProfileLastEdited(null);
      return;
    }
    setReviewProLoading(true);
    setReviewProData(null);
    setReviewEnrollment(null);
    setReviewProfileDiffs([]);
    setReviewProfileLastEdited(null);
    (async () => {
      const [profileRes, servicesRes, photosRes] = await Promise.all([
        supabase.from("pro_profiles").select("*").eq("id", reviewProId).single(),
        supabase.from("pro_services").select("category_slug, service_slug, display_name, description, custom_price_min, custom_price_max").eq("pro_profile_id", reviewProId),
        supabase.from("pro_photos").select("url, caption, is_primary").eq("pro_profile_id", reviewProId).order("is_primary", { ascending: false }),
      ]);
      const profile = profileRes.data as (Record<string, unknown> & { user_id: string; business_name: string; bio: string | null; location: string | null; years_experience: number | null; phone: string | null; website: string | null; availability: string | null; price_min: number | null; price_max: number | null; service_at_workspace_only: boolean | null; service_radius_km: number | null; created_at: string; id: string }) | null;
      const services = (servicesRes.data ?? []) as { category_slug: string; service_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null }[];
      const photos = (photosRes.data ?? []) as { url: string; caption: string | null; is_primary: boolean }[];
      if (profile) {
        setReviewProData({ profile, services, photos });
        const lastEdited = (profile as { profile_last_edited_at?: string | null }).profile_last_edited_at ?? null;
        setReviewProfileLastEdited(lastEdited);
        const baseline = parseApprovalBaselineJson((profile as { approval_baseline_json?: unknown }).approval_baseline_json);
        if (baseline) {
          const { data: applicantProfile } = await supabase
            .from("profiles")
            .select("full_name, phone, postal_code, address, birthday, email_language")
            .eq("user_id", profile.user_id)
            .maybeSingle();
          const { entries } = splitBioAndLanguages(profile.bio, locale);
          const currentSnap = snapshotFromProProfileRow(
            profile,
            services.map((s) => ({
              category_slug: s.category_slug,
              service_slug: s.service_slug,
              display_name: (s as { display_name?: string | null }).display_name ?? null,
              description: s.description,
            })),
            applicantProfile
              ? {
                  full_name: applicantProfile.full_name,
                  phone: applicantProfile.phone,
                  postal_code: applicantProfile.postal_code,
                  address: applicantProfile.address,
                  birthday: applicantProfile.birthday,
                  email_language: applicantProfile.email_language,
                }
              : null,
            entries
              .map((e) => {
                const code = e.languageLabel;
                return { code, level: e.level ?? "fluent" };
              })
              .filter((x) => x.code),
          );
          setReviewProfileDiffs(diffProProfileSnapshots(baseline, currentSnap, locale));
        }
        const [subRes, payRes] = await Promise.all([
          supabase
            .from("pro_subscriptions")
            .select("plan_id, billing_start, trial_ends_at, updated_at")
            .eq("user_id", profile.user_id)
            .maybeSingle(),
          supabase
            .from("payments")
            .select("amount_cents, currency, status, square_payment_id, created_at")
            .eq("pro_profile_id", profile.id)
            .is("booking_id", null)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);
        setReviewEnrollment({
          sub: subRes.data as {
            plan_id: string;
            billing_start: string | null;
            trial_ends_at: string | null;
            updated_at: string | null;
          } | null,
          payments: (payRes.error ? [] : (payRes.data ?? [])) as {
            amount_cents: number;
            currency: string;
            status: string;
            square_payment_id: string | null;
            created_at: string;
          }[],
          paymentsError: payRes.error?.message ?? null,
        });
      }
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
      setAllPros((prev) =>
        prev.map((p) => (p.user_id === proUserId ? { ...p, is_verified: true } : p)),
      );
      await loadAllPros();
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

  const handleAdminSetTier = async (proProfileId: string, tier: string) => {
    if (!user || !isAdmin) return;
    setUpdatingTierId(proProfileId);
    try {
      const { error } = await supabase.rpc("admin_set_pro_subscription_tier", {
        p_pro_profile_id: proProfileId,
        p_tier: tier,
      });
      if (error) throw error;
      const normalized = tier.toLowerCase().trim();
      toast({
        title: t.dashboard.adminSetTierSuccess ?? "Tier updated",
        description: (t.dashboard.adminSetTierSuccessDesc ?? "Set to {{plan}}.").replace("{{plan}}", normalized),
      });
      setAllPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: normalized } : p)));
      setPendingPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: normalized } : p)));
      const proRow = allPros.find((p) => p.id === proProfileId);
      if (proRow) {
        setAdminSubByUserId((prev) => ({
          ...prev,
          [proRow.user_id]: { ...prev[proRow.user_id], plan_id: normalized },
        }));
      }
    } catch (e) {
      toast({
        title: t.dashboard.adminSetTierFailed ?? "Could not update tier",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUpdatingTierId(null);
    }
  };

  const handleSyncTierFromSubscription = async (proProfileId: string, proUserId: string) => {
    if (!user || !isAdmin) return;
    const planId = adminSubByUserId[proUserId]?.plan_id;
    if (!planId || typeof planId !== "string") {
      toast({
        title: t.dashboard.adminSyncTierNoSub ?? "No billing plan on file",
        description: t.dashboard.adminSyncTierNoSubDesc ?? "This account has no pro_subscriptions row yet.",
        variant: "destructive",
      });
      return;
    }
    const normalized = planId.toLowerCase().trim();
    setUpdatingTierId(proProfileId);
    try {
      const { error } = await supabase
        .from("pro_profiles")
        .update({ subscription_tier: normalized, updated_at: new Date().toISOString() })
        .eq("id", proProfileId);
      if (error) throw error;
      toast({
        title: t.dashboard.adminSyncTierSuccess ?? "Profile tier synced",
        description: (t.dashboard.adminSyncTierSuccessDesc ?? "Set to {{plan}} from billing.").replace("{{plan}}", normalized),
      });
      setAllPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: normalized } : p)));
      setPendingPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, subscription_tier: normalized } : p)));
      if (reviewProData?.profile && (reviewProData.profile as { id?: string }).id === proProfileId) {
        setReviewProData((d) => (d ? { ...d, profile: { ...d.profile, subscription_tier: normalized } } : d));
      }
    } catch (e) {
      toast({
        title: t.dashboard.adminSyncTierFailed ?? "Could not sync tier",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setUpdatingTierId(null);
    }
  };

  const handleAdminReferralInvitePanel = async (proProfileId: string, enabled: boolean) => {
    if (!user || !isAdmin) return;
    setUpdatingReferralPanelId(proProfileId);
    try {
      const { error } = await supabase
        .from("pro_profiles")
        .update({ referral_invite_panel_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("id", proProfileId);
      if (error) throw error;
      setAllPros((prev) => prev.map((p) => (p.id === proProfileId ? { ...p, referral_invite_panel_enabled: enabled } : p)));
      if (proProfile?.id === proProfileId) {
        setProProfile((prev) => (prev ? { ...prev, referral_invite_panel_enabled: enabled } : prev));
      }
      toast({ title: enabled ? "Invite panel shown for this account" : "Invite panel hidden for this account" });
    } catch (e) {
      const raw = (e as { message?: string }).message ?? String(e);
      const missingCol = /referral_invite_panel_enabled/i.test(raw) && /schema cache|could not find|column/i.test(raw);
      toast({
        title: "Could not update invite panel",
        description: missingCol
          ? "Run the migration that adds pro_profiles.referral_invite_panel_enabled."
          : raw,
        variant: "destructive",
      });
    } finally {
      setUpdatingReferralPanelId(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, birthday, email_language, avatar_url, postal_code, address, booking_id_verification_photo_path, is_platform_admin, public_user_number")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setAccountForm({
          full_name: data.full_name ?? "",
          phone: formatCanadianPhone(data.phone ?? ""),
          postal_code: (data as { postal_code?: string | null }).postal_code
            ? formatCanadianPostal((data as { postal_code?: string | null }).postal_code ?? "")
            : "",
          address: (data as { address?: string | null }).address?.trim() ?? "",
          birthday: data.birthday ?? "",
          email_language: data.email_language === "fr" ? "fr" : "en",
        });
      }
    })();
  }, [user]);

  useEffect(() => {
    const path = profile?.booking_id_verification_photo_path?.trim();
    if (!path) {
      setBookingIdVerificationPreviewUrl(null);
      return;
    }
    let cancelled = false;
    void supabase.storage
      .from(CLIENT_BOOKING_ID_VERIFICATION_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) setBookingIdVerificationPreviewUrl(null);
        else setBookingIdVerificationPreviewUrl(data.signedUrl);
      })
      .catch(() => {
        if (!cancelled) setBookingIdVerificationPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.booking_id_verification_photo_path]);

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
      toast({
        title: t.dashboard.saved ?? "Saved",
        description: [t.dashboard.scheduleSaved ?? "Schedule updated.", t.dashboard.schedulePublicApplyHint].filter(Boolean).join(" "),
      });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleSaveBlockedHours = async () => {
    if (!proProfile) return;
    setSavingBlockedHours(true);
    try {
      const payload = {
        unavailable_dates: Object.keys(proUnavailableDates).length ? proUnavailableDates : {},
        available_date_overrides: proAvailableDateOverrides,
      };
      const { error } = await supabase.from("pro_profiles").update(payload).eq("id", proProfile.id);
      if (error) throw error;
      toast({
        title: t.dashboard.saved ?? "Saved",
        description: t.dashboard.scheduleBlockedHoursSaved ?? "Blocked hours saved for your public page.",
      });
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingBlockedHours(false);
    }
  };

  const normalizeProBookingRow = useCallback(
    (row: ProBookingRealtimeRow): (typeof proBookings)[number] => ({
      ...row,
      service_duration_minutes: row.service_duration_minutes ?? null,
    }),
    [],
  );

  const loadClientProfileForBooking = useCallback(async (clientId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name, phone, booking_id_verification_photo_path")
      .eq("user_id", clientId)
      .maybeSingle();
    if (!data) return;
    setClientProfiles((prev) => ({
      ...prev,
      [data.user_id]: {
        full_name: data.full_name ?? null,
        phone: data.phone ?? null,
        booking_id_verification_photo_path: data.booking_id_verification_photo_path ?? null,
      },
    }));
  }, []);

  const mergeRealtimeProBooking = useCallback(
    async (row: ProBookingRealtimeRow, event: "insert" | "update") => {
      let full = row;
      if (!row.client_id || row.invoice_snapshot === undefined) {
        const { data } = await supabase.from("bookings").select(PRO_BOOKING_SELECT).eq("id", row.id).maybeSingle();
        if (data) full = data as ProBookingRealtimeRow;
      }
      const normalized = normalizeProBookingRow(full);
      setProBookings((prev) => {
        const idx = prev.findIndex((b) => b.id === normalized.id);
        if (event === "insert" && idx === -1) return [normalized, ...prev];
        if (idx === -1) return [normalized, ...prev];
        return prev.map((b) => (b.id === normalized.id ? { ...b, ...normalized } : b));
      });
      if (full.client_id) void loadClientProfileForBooking(full.client_id);
      if (event === "insert" && full.status === "pending") {
        toast({
          title: t.dashboard.whatsNewBookingPro ?? "New booking request",
          description: t.dashboard.newBookingRealtimeToast ?? "You have a new booking request.",
        });
      }
      refreshBookingNotificationCount();
      void refreshWhatsNew();
    },
    [
      loadClientProfileForBooking,
      normalizeProBookingRow,
      refreshBookingNotificationCount,
      refreshWhatsNew,
      t.dashboard.newBookingRealtimeToast,
      t.dashboard.whatsNewBookingPro,
      toast,
    ],
  );

  useProBookingsRealtime(proProfile?.id, Boolean(proProfile?.is_verified), {
    onInsert: (row) => {
      void mergeRealtimeProBooking(row, "insert");
    },
    onUpdate: (row) => {
      void mergeRealtimeProBooking(row, "update");
    },
    onDelete: (id) => {
      setProBookings((prev) => prev.filter((b) => b.id !== id));
      refreshBookingNotificationCount();
      void refreshWhatsNew();
    },
  });

  const proBookingDetail = useMemo(
    () => proBookings.find((b) => b.id === proBookingDetailId) ?? null,
    [proBookings, proBookingDetailId],
  );

  const handleSaveProAesthetic = async () => {
    if (!proProfile) return;
    setSavingProAesthetic(true);
    try {
      // Core fields (exist on older schemas) ? required for "save color" to work
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

      // Newer columns (service_tags) ? skip if schema doesn't have them yet
      const { error: extraError } = await supabase
        .from("pro_profiles")
        .update({
          service_tags: proServiceTags.length > 0 ? proServiceTags : null,
        })
        .eq("id", proProfile.id);
      if (extraError) {
        console.warn("Pro profile extra fields (tags) not saved ? add columns if needed:", extraError.message);
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
    setServiceFormService("");
    setServiceFormPriceMin("");
    setServiceFormPriceMax("");
    setServiceFormDurationMins(null);
    setServiceFormDescription("");
    setServiceFormDisplayName("");
    setServiceFormAutoReply("");
    setServiceFormRenewalMonths("");
    setServiceFormLocationMode(proProfile ? profileDefaultMode(proProfile) : "travel");
    setServiceFormWorkspaceAddress("");
    setServiceFormWorkspaceLat(null);
    setServiceFormWorkspaceLng(null);
    setServiceFormCancelPolicy("late_fee");
    setServiceFormCancelFeeType("fixed");
    setServiceFormCancelFeePercent(50);
    setServiceFormCancelFeeDollars("");
    setServiceDialogOpen(true);
  };

  const openEditServiceDialog = (row: ProServiceRow) => {
    setServiceDialogEditing(row);
    setServiceFormService(row.service_slug);
    const existingPrice = row.custom_price_min != null ? row.custom_price_min : row.custom_price_max;
    setServiceFormPriceMin(existingPrice != null ? String(existingPrice) : "");
    setServiceFormPriceMax("");
    setServiceFormDescription(stripLegacyDurationFromDescription(row.description) || "");
    setServiceFormDurationMins(row.duration_minutes);
    setServiceFormDisplayName(row.display_name?.trim() ?? "");
    setServiceFormAutoReply(row.auto_reply_message?.trim() ?? "");
    setServiceFormRenewalMonths(row.renewal_interval_months != null ? String(row.renewal_interval_months) : "");
    const lm = row.location_mode?.trim();
    setServiceFormLocationMode(
      lm === "workspace" || lm === "travel" || lm === "both"
        ? lm
        : proProfile
          ? profileDefaultMode(proProfile)
          : "travel",
    );
    setServiceFormWorkspaceAddress(row.workspace_address?.trim() ?? "");
    setServiceFormWorkspaceLat(row.workspace_latitude ?? null);
    setServiceFormWorkspaceLng(row.workspace_longitude ?? null);
    const cp = (row.cancel_policy ?? "late_fee").toLowerCase();
    setServiceFormCancelPolicy(cp === "free" || cp === "no_cancel" || cp === "late_fee" ? cp : "late_fee");
    setServiceFormCancelFeeType((row.cancel_fee_type ?? "").toLowerCase() === "percent" ? "percent" : "fixed");
    const cfp = row.cancel_fee_percent;
    setServiceFormCancelFeePercent(cfp === 25 || cfp === 50 || cfp === 75 ? cfp : 50);
    const cents = typeof row.cancel_fee_cents === "number" && Number.isFinite(row.cancel_fee_cents) ? row.cancel_fee_cents : 0;
    setServiceFormCancelFeeDollars(cents > 0 ? String(Math.round(cents / 100)) : "");
    setServiceDialogOpen(true);
  };

  const loadProServicesForDashboard = useCallback(async (proId: string) => {
    const full =
      "category_slug, service_slug, description, display_name, custom_price_min, custom_price_max, duration_minutes, auto_reply_message, renewal_interval_months, location_mode, workspace_address, workspace_latitude, workspace_longitude, cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents";
    const { data: d0, error: e0 } = await supabase.from("pro_services").select(full).eq("pro_profile_id", proId);
    if (!e0 && d0) {
      setProServices(d0 as ProServiceRow[]);
      return;
    }
    const { data: d1, error: e1 } = await supabase
      .from("pro_services")
      .select("category_slug, service_slug, description, display_name, custom_price_min, custom_price_max")
      .eq("pro_profile_id", proId);
    if (!e1 && d1) {
      setProServices(
        (d1 as Omit<ProServiceRow, "duration_minutes">[]).map((row) => ({ ...row, duration_minutes: null }))
      );
      return;
    }
    if (e1?.message?.includes("display_name")) {
      const { data: d2 } = await supabase
        .from("pro_services")
        .select("category_slug, service_slug, description, custom_price_min, custom_price_max, duration_minutes")
        .eq("pro_profile_id", proId);
      if (d2) {
        setProServices((d2 as ProServiceRow[]) ?? []);
        return;
      }
      const { data: d3 } = await supabase
        .from("pro_services")
        .select("category_slug, service_slug, description, custom_price_min, custom_price_max")
        .eq("pro_profile_id", proId);
      setProServices(
        ((d3 as Omit<ProServiceRow, "display_name" | "duration_minutes">[] | null) ?? []).map((row) => ({
          ...row,
          display_name: null,
          duration_minutes: null,
        }))
      );
      return;
    }
    setProServices([]);
  }, []);

  const handleSaveService = async () => {
    const mainCat = proProfile?.primary_category_slug?.trim();
    if (!proProfile || !mainCat || !serviceFormService) return;
    setSavingService(true);
    try {
      const about = serviceFormDescription.trim() || null;
      const price = serviceFormPriceMin.trim() ? parseInt(serviceFormPriceMin, 10) : null;
      const displayName = serviceFormDisplayName.trim() || null;
      const durationMins = serviceFormDurationMins;
      const growth = hasGrowthServiceExtras(subscriptionTierNormalized);
      let renewalM: number | null = null;
      if (growth && serviceFormRenewalMonths.trim()) {
        const n = parseInt(serviceFormRenewalMonths, 10);
        if (!Number.isNaN(n) && n >= 1 && n <= 120) renewalM = n;
      }
      const autoReply = growth && serviceFormAutoReply.trim() ? serviceFormAutoReply.trim() : null;
      const contactSegments: { v: string | null | undefined; label: string }[] = [
        { v: about, label: t.dashboard.publicContactFieldDescription ?? "service description" },
        { v: displayName, label: t.dashboard.publicContactFieldDisplayName ?? "display name" },
      ];
      if (growth) contactSegments.push({ v: autoReply, label: t.dashboard.publicContactFieldAutoReply ?? "auto-reply" });
      for (const { v, label } of contactSegments) {
        if (!v?.trim()) continue;
        if (getProPublicContactBlacklistReasons(v).length === 0) continue;
        toast({
          title: t.dashboard.publicContactBlockedTitle ?? "Cannot save",
          description: (t.dashboard.publicContactBlockedDesc ?? "Remove phone numbers, emails, or links from: {{field}}.").replace("{{field}}", label),
          variant: "destructive",
        });
        setSavingService(false);
        return;
      }
      const effectiveLocationMode = serviceFormLocationMode;
      let wsLat = serviceFormWorkspaceLat;
      let wsLng = serviceFormWorkspaceLng;
      if (serviceModeNeedsWorkspaceAddress(effectiveLocationMode)) {
        const wsAddr = serviceFormWorkspaceAddress.trim();
        if (!wsAddr) {
          toast({
            title: t.auth?.toastError ?? "Error",
            description: t.dashboard.serviceWorkspaceAddressRequired,
            variant: "destructive",
          });
          setSavingService(false);
          return;
        }
        if (wsLat == null || wsLng == null) {
          const geo = await geocodeAddress(wsAddr);
          if (!geo) {
            toast({
              title: t.auth?.toastError ?? "Error",
              description: t.dashboard.accountPostalInvalid ?? "Could not verify that address.",
              variant: "destructive",
            });
            setSavingService(false);
            return;
          }
          wsLat = geo.lat;
          wsLng = geo.lng;
        }
      }
      const workspacePayload =
        serviceModeNeedsWorkspaceAddress(effectiveLocationMode) && serviceFormWorkspaceAddress.trim()
          ? {
              workspace_address: serviceFormWorkspaceAddress.trim(),
              workspace_latitude: wsLat,
              workspace_longitude: wsLng,
            }
          : {
              workspace_address: null,
              workspace_latitude: null,
              workspace_longitude: null,
            };
      let cancelFeeCents = 0;
      if (serviceFormCancelPolicy === "late_fee" && serviceFormCancelFeeType === "fixed") {
        const dollars = parseInt(serviceFormCancelFeeDollars.trim() || "0", 10);
        if (Number.isNaN(dollars) || dollars < 1) {
          toast({
            title: t.auth?.toastError ?? "Error",
            description:
              locale === "fr"
                ? "Indiquez un montant de frais d’annulation (ex. 20 $)."
                : "Enter a cancellation fee amount (e.g. 20).",
            variant: "destructive",
          });
          setSavingService(false);
          return;
        }
        cancelFeeCents = dollars * 100;
        if (price != null && !Number.isNaN(price) && cancelFeeCents > price * 100) {
          toast({
            title: t.auth?.toastError ?? "Error",
            description:
              locale === "fr"
                ? "Les frais d’annulation ne peuvent pas dépasser le prix du service."
                : "Cancellation fee cannot exceed the service price.",
            variant: "destructive",
          });
          setSavingService(false);
          return;
        }
      }
      const cancelPayload = {
        cancel_policy: serviceFormCancelPolicy,
        cancel_fee_type: serviceFormCancelPolicy === "late_fee" ? serviceFormCancelFeeType : "percent",
        cancel_fee_percent: serviceFormCancelFeePercent,
        cancel_fee_cents: serviceFormCancelPolicy === "late_fee" && serviceFormCancelFeeType === "fixed" ? cancelFeeCents : 0,
      };
      if (serviceDialogEditing) {
        const baseUpdate: Record<string, unknown> = {
          description: about,
          custom_price_min: price,
          custom_price_max: price,
          display_name: displayName,
          duration_minutes: durationMins,
          ...cancelPayload,
        };
        if (growth) {
          baseUpdate.auto_reply_message = autoReply;
          baseUpdate.renewal_interval_months = renewalM;
        }
        baseUpdate.location_mode = serviceFormLocationMode;
        Object.assign(baseUpdate, workspacePayload);
        const { error } = await supabase
          .from("pro_services")
          .update(baseUpdate)
          .eq("pro_profile_id", proProfile.id)
          .eq("category_slug", serviceDialogEditing.category_slug)
          .eq("service_slug", serviceDialogEditing.service_slug);
        if (error) throw error;
        toast({ title: t.dashboard.saved ?? "Saved" });
      } else {
        const baseInsert: Record<string, unknown> = {
          pro_profile_id: proProfile.id,
          category_slug: mainCat,
          service_slug: serviceFormService,
          description: about,
          display_name: displayName,
          custom_price_min: price,
          custom_price_max: price,
          duration_minutes: durationMins,
          ...cancelPayload,
        };
        if (growth) {
          baseInsert.auto_reply_message = autoReply;
          baseInsert.renewal_interval_months = renewalM;
        }
        baseInsert.location_mode = serviceFormLocationMode;
        Object.assign(baseInsert, workspacePayload);
        const { error } = await supabase.from("pro_services").insert(baseInsert);
        if (error) throw error;
        toast({ title: t.dashboard.saved ?? "Saved" });
      }
      setServiceDialogOpen(false);
      await loadProServicesForDashboard(proProfile.id);
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingService(false);
    }
  };

  const handleSaveBundle = async () => {
    if (!proProfile?.id) return;
    if (!bundleFormName.trim()) {
      toast({ title: t.auth?.toastError ?? "Error", description: t.dashboard.bundleNameLabel ?? "Name", variant: "destructive" });
      return;
    }
    if (bundleFormKeys.length < 2) {
      toast({
        title: t.auth?.toastError ?? "Error",
        description: t.dashboard.bundleNeedTwoServices ?? "Choose at least two services.",
        variant: "destructive",
      });
      return;
    }
    setSavingBundle(true);
    try {
      const { data: bundleRow, error: bErr } = await supabase
        .from("service_bundles")
        .insert({ pro_profile_id: proProfile.id, name: bundleFormName.trim() })
        .select("id")
        .single();
      if (bErr) throw bErr;
      const bid = bundleRow?.id as string;
      const itemRows = bundleFormKeys.map((key) => {
        const [category_slug, service_slug] = key.split("/");
        return { bundle_id: bid, category_slug, service_slug };
      });
      const { error: iErr } = await supabase.from("service_bundle_items").insert(itemRows);
      if (iErr) throw iErr;
      toast({ title: t.dashboard.saved ?? "Saved" });
      setBundleDialogOpen(false);
      setBundleFormName("");
      setBundleFormKeys([]);
      setServiceBundles((prev) => [
        ...prev,
        {
          id: bid,
          name: bundleFormName.trim(),
          items: bundleFormKeys.map((key) => {
            const [category_slug, service_slug] = key.split("/");
            return { category_slug, service_slug };
          }),
        },
      ]);
    } catch (e) {
      toast({ title: t.auth?.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingBundle(false);
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
    if (!user || isMonitorAdmin) return;
    (async () => {
      const full =
        "id, created_at, status, pro_profile_id, responded_at, auto_reply_snapshot, service_category_slug, service_slug, client_renews_annually, renewal_anchor_date, renewal_interval_months_snapshot, client_unread, preferred_date, preferred_time, service_duration_minutes, invoice_snapshot, public_booking_code";
      let res = await supabase
        .from("bookings")
        .select(full)
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (res.error) {
        res = await supabase
          .from("bookings")
          .select(
            "id, created_at, status, pro_profile_id, responded_at, auto_reply_snapshot, service_category_slug, service_slug, client_renews_annually, renewal_anchor_date, renewal_interval_months_snapshot, client_unread, preferred_date, preferred_time, service_duration_minutes"
          )
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
      }
      if (res.error) {
        res = await supabase
          .from("bookings")
          .select("id, created_at, status, pro_profile_id")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);
      }
      const rows = (res.data || []) as {
        id: string;
        created_at: string;
        status: string;
        pro_profile_id: string;
        responded_at?: string | null;
        auto_reply_snapshot?: string | null;
        service_category_slug?: string | null;
        service_slug?: string | null;
        client_renews_annually?: boolean | null;
        renewal_anchor_date?: string | null;
        renewal_interval_months_snapshot?: number | null;
        client_unread?: boolean | null;
        preferred_date?: string | null;
        preferred_time?: string | null;
        service_duration_minutes?: number | null;
        invoice_snapshot?: unknown;
        public_booking_code?: string | null;
      }[];
      if (rows.length > 0) {
        const proIds = [...new Set(rows.map((b) => b.pro_profile_id))];
        const [{ data: pros }, reviewsRes] = await Promise.all([
          supabase
            .from("pro_profiles")
            .select("id, business_name, service_at_workspace_only, business_address")
            .in("id", proIds),
          supabase.from("reviews").select("pro_profile_id").eq("reviewer_id", user.id),
        ]);
        const meta: Record<string, { name: string; ws: boolean | null; addr: string | null }> = {};
        (pros || []).forEach((p: { id: string; business_name: string; service_at_workspace_only?: boolean | null; business_address?: string | null }) => {
          meta[p.id] = {
            name: p.business_name || "",
            ws: p.service_at_workspace_only ?? null,
            addr: typeof p.business_address === "string" && p.business_address.trim() ? p.business_address.trim() : null,
          };
        });
        setClientBookings(
          rows.map((r) => ({
            ...r,
            business_name: meta[r.pro_profile_id]?.name ?? "",
            pro_service_at_workspace_only: meta[r.pro_profile_id]?.ws ?? null,
            pro_business_address: meta[r.pro_profile_id]?.addr ?? null,
          })),
        );
        setReviewedProIds(
          new Set(
            reviewsRes.error
              ? []
              : (reviewsRes.data || []).map((r: { pro_profile_id: string }) => r.pro_profile_id),
          ),
        );
      } else {
        setClientBookings([]);
        setReviewedProIds(new Set());
      }
    })();
  }, [user, isMonitorAdmin]);

  useEffect(() => {
    if (!user?.id) return;
    const ids = clientBookings.map((b) => b.id);
    if (ids.length === 0) {
      setBookingPaymentsById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("booking_id, amount_cents, currency, square_payment_id, status")
        .in("booking_id", ids);
      if (cancelled) return;
      if (error || !data) {
        setBookingPaymentsById({});
        return;
      }
      const m: Record<string, { amount_cents: number; currency: string; square_payment_id: string | null; status: string }> = {};
      for (const row of data as {
        booking_id: string | null;
        amount_cents: number;
        currency: string;
        square_payment_id: string | null;
        status: string;
      }[]) {
        if (row.booking_id) m[row.booking_id] = row;
      }
      setBookingPaymentsById(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, clientBookings]);
  useEffect(() => {
    if (!user || isMonitorAdmin) return;
    (async () => {
      const { data: requests } = await fetchJobRequestsForClient(user.id);
      const reqs = (requests || []) as JobRequest[];
      setJobRequests(reqs);
      if (reqs.length === 0) {
        setJobQuotesByRequestId({});
        return;
      }
      const reqIds = reqs.map((r) => r.id);
      let quoteRes = await supabase
        .from("job_quotes")
        .select("id, job_request_id, pro_profile_id, price_cents, estimated_time, proposed_service_date, message, status, created_at")
        .in("job_request_id", reqIds)
        .order("created_at", { ascending: false });
      if (quoteRes.error?.message?.includes("proposed_service_date")) {
        quoteRes = await supabase
          .from("job_quotes")
          .select("id, job_request_id, pro_profile_id, price_cents, estimated_time, message, status, created_at")
          .in("job_request_id", reqIds)
          .order("created_at", { ascending: false });
      }
      const quotes = quoteRes.data;
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

  /** When opening "send quote", seed date defaults from the job (must run before any early return ? Rules of Hooks). */
  useEffect(() => {
    if (!selectedJobForQuote) return;
    const mode = (selectedJobForQuote.scheduling_mode ?? "").toLowerCase();
    if (mode === "specific_day" && selectedJobForQuote.preferred_date) {
      setQuoteEstimatedDate(parseScheduleDay(selectedJobForQuote.preferred_date));
    } else if (mode === "range" && selectedJobForQuote.range_start_date) {
      setQuoteEstimatedDate(parseScheduleDay(selectedJobForQuote.range_start_date));
    } else {
      setQuoteEstimatedDate(undefined);
    }
    setQuoteTimeFrom("");
    setQuoteTimeTo("");
    setQuoteEstimatedTime("");
  }, [selectedJobForQuote?.id]);

  // Pro: fetch open job_requests (age + distance rules; fallback if DB columns missing)
  useEffect(() => {
    if (!user || !proProfile?.is_verified) {
      setAvailableJobs([]);
      setAvailableJobsNoCoordsBanner(false);
      return;
    }
    let cancelled = false;
    void purgeStaleJobRequests();
    (async () => {
      const browseOrigin = getBrowsePostalLocation();
      const { data: proRow } = await supabase
        .from("pro_profiles")
        .select("latitude, longitude, service_radius_km, location")
        .eq("id", proProfile.id)
        .single();
      if (cancelled) return;
      const proLat = (proRow as { latitude?: number | null } | null)?.latitude ?? null;
      const proLng = (proRow as { longitude?: number | null } | null)?.longitude ?? null;
      const radiusKm = (proRow as { service_radius_km?: number | null } | null)?.service_radius_km ?? 50;
      const proLocationText = (proRow as { location?: string | null } | null)?.location ?? null;
      const originLat = browseOrigin?.lat ?? proLat;
      const originLng = browseOrigin?.lng ?? proLng;
      const proHasCoords = originLat != null && originLng != null;
      setAvailableJobsNoCoordsBanner(!proHasCoords);
      const proPostal = extractCanadianPostal(proLocationText);
      const postalCoordCache = new Map<string, { lat: number; lng: number }>();

      const coordFromPostal = async (postal: string | null): Promise<{ lat: number; lng: number } | null> => {
        if (!postal) return null;
        const key = postal.toUpperCase();
        if (postalCoordCache.has(key)) return postalCoordCache.get(key)!;
        const geo = await geocodePostalToLocation(key);
        if (!geo) return null;
        const c = { lat: geo.lat, lng: geo.lng };
        postalCoordCache.set(key, c);
        return c;
      };

      let res = await supabase
        .from("job_requests")
        .select(JOB_REQUESTS_LEADS_SELECT_FULL)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(CLIENT_REQUEST_FETCH_LIMIT);
      if (res.error) {
        res = await supabase
          .from("job_requests")
          .select(JOB_REQUESTS_LEADS_SELECT_MINIMAL)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(CLIENT_REQUEST_FETCH_LIMIT);
      }
      if (cancelled) return;
      const list = (res.data || []) as (JobRequest & { latitude: number | null; longitude: number | null })[];
      const cutoffMs = Date.now() - OPEN_LEADS_MAX_AGE_MS;
      const recent = list.filter((j) => {
        const time = new Date(j.created_at).getTime();
        return !Number.isNaN(time) && time >= cutoffMs;
      });

      const withCoords = recent.filter((j) => j.latitude != null && j.longitude != null);
      const withoutCoords = recent.filter((j) => j.latitude == null || j.longitude == null);

      if (!proHasCoords) {
        const merged = [...withCoords, ...withoutCoords].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAvailableJobs(
          merged.map((j) => ({ ...j, distance_km: undefined, outside_service_radius: false }))
        );
        return;
      }

      const scored: AvailableJobItem[] = [];
      for (const j of recent) {
        const jobPostalCoord = await coordFromPostal(j.postal_code ?? null);
        const jobLat = jobPostalCoord?.lat ?? j.latitude;
        const jobLng = jobPostalCoord?.lng ?? j.longitude;
        const d =
          originLat != null && originLng != null && jobLat != null && jobLng != null
            ? distanceKm(originLat, originLng, jobLat, jobLng)
            : undefined;
        const radiusKmFromPro =
          proLat != null && proLng != null && jobLat != null && jobLng != null
            ? distanceKm(proLat, proLng, jobLat, jobLng)
            : d;
        const outside =
          radiusKmFromPro != null ? radiusKmFromPro > radiusKm : false;
        scored.push({ ...j, distance_km: d, outside_service_radius: outside });
      }
      const inside = scored
        .filter((j) => !j.outside_service_radius)
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
        ;
      const outside = scored
        .filter((j) => j.outside_service_radius)
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
        ;
      const tail = scored.filter((j) => j.distance_km == null).map((j) => ({
        ...j,
        outside_service_radius: false as const,
      }));
      setAvailableJobs([...inside, ...outside, ...tail]);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, proProfile?.id, proProfile?.is_verified, browsePostalTick, accountForm.postal_code]);

  useEffect(() => {
    setAccountMainCategory(proProfile?.primary_category_slug?.trim() ?? "");
  }, [proProfile?.id, proProfile?.primary_category_slug]);

  useEffect(() => {
    const biz = proProfile?.business_address?.trim();
    if (!biz) return;
    setAccountForm((prev) => (prev.address.trim() ? prev : { ...prev, address: biz }));
  }, [proProfile?.id, proProfile?.business_address]);

  useEffect(() => {
    if (!user) {
      setProProfileLoading(false);
      setCachedProVerified(null);
      return;
    }
    setCachedProVerified(readDashboardProVerifiedCache(user.id));
    if (!platformAdminReady && isPlatformAdminEmail(user.email)) return;
    if (isMonitorAdmin) {
      setProProfile(null);
      setProProfileLoading(false);
      setProSubscriptionPlanId(null);
      setProPrimaryPhotoUrl(null);
      setProBookings([]);
      setClientBookings([]);
      setJobRequests([]);
      return;
    }
    setProProfileLoading(true);
    (async () => {
      const { data: proData, error: proError } = await supabase
        .from("pro_profiles")
        .select(
          "id, business_name, availability, is_verified, price_min, price_max, subscription_tier, page_template, page_primary_color, page_secondary_color, page_accent_color, page_background_color, page_header_text, unavailable_dates, available_date_overrides, primary_category_slug, referral_invite_panel_enabled, square_location_id, service_at_workspace_only, offers_workspace, offers_travel, business_address, latitude, longitude, service_radius_km, booking_cancel_policy, booking_cancel_fee_percent"
        )
        .eq("user_id", user.id)
        .single();
      let pro = proData as {
        id: string;
        business_name: string;
        availability: string | null;
        is_verified: boolean;
        subscription_tier?: string | null;
        price_min?: number | null;
        price_max?: number | null;
        primary_category_slug?: string | null;
        unavailable_dates?: UnavailableDatesMap;
        available_date_overrides?: string[];
        referral_invite_panel_enabled?: boolean | null;
        square_location_id?: string | null;
        service_at_workspace_only?: boolean | null;
        business_address?: string | null;
      } | null;
      if (proError && (proError.message?.includes("unavailable_dates") || proError.message?.includes("available_date_overrides") || proError.message?.includes("primary_category_slug") || proError.message?.includes("referral_invite_panel_enabled") || proError.message?.includes("square_location_id"))) {
        const { data: fallback } = await supabase
          .from("pro_profiles")
          .select(
            "id, business_name, availability, is_verified, price_min, price_max, subscription_tier, page_template, page_primary_color, page_secondary_color, page_accent_color, page_background_color, page_header_text, unavailable_dates, available_date_overrides"
          )
          .eq("user_id", user.id)
          .single();
        pro = { ...(fallback as typeof pro), primary_category_slug: (fallback as { primary_category_slug?: null })?.primary_category_slug ?? null };
      }
      const { data: subRow } = await supabase.from("pro_subscriptions").select("plan_id").eq("user_id", user.id).maybeSingle();
      setProSubscriptionPlanId(typeof subRow?.plan_id === "string" ? subRow.plan_id : null);

      if (!pro) {
        setProProfile(null);
        setProSubscriptionPlanId(null);
        setProPrimaryPhotoUrl(null);
        setCachedProVerified(false);
        writeDashboardProVerifiedCache(user.id, false);
        setProProfileLoading(false);
        return;
      }
      setProProfile({
        ...pro,
        is_verified: pro.is_verified === true,
        referral_invite_panel_enabled: pro.referral_invite_panel_enabled,
        square_location_id:
          typeof pro.square_location_id === "string" && pro.square_location_id.trim()
            ? pro.square_location_id.trim()
            : null,
      });
      {
        const rawPolicy = String((pro as { booking_cancel_policy?: string }).booking_cancel_policy ?? "late_fee");
        setBookingCancelPolicy(
          rawPolicy === "free" || rawPolicy === "no_cancel" || rawPolicy === "late_fee" ? rawPolicy : "late_fee",
        );
        const rawFee = Number((pro as { booking_cancel_fee_percent?: number }).booking_cancel_fee_percent ?? 50);
        setBookingCancelFeePercent(rawFee === 25 || rawFee === 50 || rawFee === 75 ? rawFee : 50);
      }
      setCachedProVerified(pro.is_verified === true);
      writeDashboardProVerifiedCache(user.id, pro.is_verified === true);
      setProWeeklySchedule(parseAvailabilityToWeekly(pro.availability));
      setProUnavailableDates(pro.unavailable_dates && typeof pro.unavailable_dates === "object" ? pro.unavailable_dates : {});
      setProAvailableDateOverrides(Array.isArray(pro.available_date_overrides) ? pro.available_date_overrides : []);
      setProProfileLoading(false);
      const { data: primaryPhoto } = await supabase.from("pro_photos").select("url").eq("pro_profile_id", pro.id).eq("is_primary", true).limit(1).maybeSingle();
      setProPrimaryPhotoUrl(primaryPhoto?.url ?? null);
      if (!pro.is_verified) {
        setProBookings([]);
        setProStats({ leads: 0, clicks: 0, rank: null, total: null, categorySlug: null, reviewCount: 0 });
        setClientProfiles({});
        setReviewedClientIds(new Set());
        return;
      }
      const [bookingsRes, viewsRes, rankRes, ratingRes, bookingsListRes] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("pro_profile_id", pro.id).in("status", ["pending", "accepted", "completed"]),
        supabase.from("pro_profile_views").select("id", { count: "exact", head: true }).eq("pro_profile_id", pro.id),
        supabase.rpc("get_pro_rank_in_category", { p_pro_profile_id: pro.id }),
        supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: pro.id }),
        supabase
          .from("bookings")
          .select(
            "id, created_at, preferred_date, preferred_time, service_duration_minutes, status, client_id, decline_reason, responded_at, auto_reply_snapshot, service_category_slug, service_slug, client_renews_annually, renewal_anchor_date, renewal_interval_months_snapshot, invoice_snapshot, public_booking_code, service_location_choice, distance_km_snapshot, drive_minutes_snapshot, pro_unread"
          )
          .eq("pro_profile_id", pro.id)
          .order("created_at", { ascending: false })
          .limit(CLIENT_REQUEST_FETCH_LIMIT),
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
      let listRaw = (bookingsListRes.data as {
        id: string;
        created_at: string;
        status: string;
        client_id: string;
        decline_reason?: string | null;
        preferred_date?: string | null;
        preferred_time?: string | null;
        service_duration_minutes?: number | null;
        responded_at?: string | null;
        auto_reply_snapshot?: string | null;
        service_category_slug?: string | null;
        service_slug?: string | null;
        client_renews_annually?: boolean | null;
        renewal_anchor_date?: string | null;
        renewal_interval_months_snapshot?: number | null;
      }[]) ?? [];
      if (bookingsListRes.error) {
        const { data: fb } = await supabase
          .from("bookings")
          .select("id, created_at, preferred_date, preferred_time, status, client_id, decline_reason")
          .eq("pro_profile_id", pro.id)
          .order("created_at", { ascending: false })
          .limit(CLIENT_REQUEST_FETCH_LIMIT);
        listRaw = ((fb as typeof listRaw) || []).map((b) => ({
          ...b,
          service_duration_minutes: null,
          responded_at: null,
          auto_reply_snapshot: null,
          service_category_slug: null,
          service_slug: null,
          client_renews_annually: null,
          renewal_anchor_date: null,
          renewal_interval_months_snapshot: null,
        }));
      }
      const list = listRaw.map((b) => ({
        ...b,
        service_duration_minutes: b.service_duration_minutes ?? null,
      }));
      setProBookings(list);
      const clientIds = [...new Set(list.map((b) => b.client_id).filter(Boolean))];
      if (clientIds.length > 0) {
        const [profilesRes, reviewsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, phone, booking_id_verification_status, booking_id_verification_photo_path")
            .in("user_id", clientIds),
          supabase.from("client_reviews").select("client_id").eq("pro_profile_id", pro.id),
        ]);
        const map: Record<
          string,
          {
            full_name: string | null;
            phone: string | null;
            booking_id_verification_status?: string | null;
            booking_id_verification_photo_path?: string | null;
          }
        > = {};
        (profilesRes.data || []).forEach(
          (p: {
            user_id: string;
            full_name: string | null;
            phone: string | null;
            booking_id_verification_status?: string | null;
            booking_id_verification_photo_path?: string | null;
          }) => {
            map[p.user_id] = {
              full_name: p.full_name ?? null,
              phone: p.phone ?? null,
              booking_id_verification_status:
                p.booking_id_verification_status ??
                (p.booking_id_verification_photo_path ? "verified" : "none"),
              // Do not expose path to pro UI — status only (LR-007).
              booking_id_verification_photo_path: null,
            };
          },
        );
        setClientProfiles(map);
        // Pros must not receive ID image URLs.
        setClientIdVerificationUrls({});
        setReviewedClientIds(new Set(reviewsRes.error ? [] : (reviewsRes.data || []).map((r: { client_id: string }) => r.client_id)));
      } else {
        setClientProfiles({});
        setClientIdVerificationUrls({});
        setReviewedClientIds(new Set());
      }
    })();
  }, [user, proProfileRefreshKey, isMonitorAdmin, platformAdminReady]);

  useEffect(() => {
    const p = proProfile as { price_min?: number | null } | null;
    setStartingPriceInput(p?.price_min != null ? String(p.price_min) : "");
  }, [proProfile?.id, (proProfile as { price_min?: number | null } | null)?.price_min]);

  useEffect(() => {
    if (!proProfile?.id || !proProfile?.is_verified) {
      setProServices([]);
      return;
    }
    void loadProServicesForDashboard(proProfile.id);
  }, [proProfile?.id, proProfile?.is_verified, loadProServicesForDashboard]);

  useEffect(() => {
    if (!proProfile?.id || !proProfile?.is_verified) {
      setServiceBundles([]);
      return;
    }
    void (async () => {
      const { data: bundles, error } = await supabase.from("service_bundles").select("id, name").eq("pro_profile_id", proProfile.id);
      if (error || !bundles?.length) {
        setServiceBundles([]);
        return;
      }
      const ids = bundles.map((b: { id: string }) => b.id);
      const { data: items, error: itemsErr } = await supabase
        .from("service_bundle_items")
        .select("bundle_id, category_slug, service_slug")
        .in("bundle_id", ids);
      if (itemsErr) {
        setServiceBundles([]);
        return;
      }
      const byId = new Map<string, { category_slug: string; service_slug: string }[]>();
      (items || []).forEach((row: { bundle_id: string; category_slug: string; service_slug: string }) => {
        const list = byId.get(row.bundle_id) ?? [];
        list.push({ category_slug: row.category_slug, service_slug: row.service_slug });
        byId.set(row.bundle_id, list);
      });
      setServiceBundles(
        (bundles as { id: string; name: string }[]).map((b) => ({
          id: b.id,
          name: b.name,
          items: byId.get(b.id) ?? [],
        }))
      );
    })();
  }, [proProfile?.id, proProfile?.is_verified]);

  useEffect(() => {
    if (!user) {
      setSavedPros([]);
      return;
    }
    (async () => {
      setSavedProsLoading(true);
      const { data: rows, error } = await supabase
        .from("client_saved_pros")
        .select("pro_profile_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
        setSavedPros([]);
        setSavedProsLoading(false);
        return;
      }
      const ids = (rows || []).map((r) => (r as { pro_profile_id: string }).pro_profile_id);
      if (ids.length === 0) {
        setSavedPros([]);
        setSavedProsLoading(false);
        return;
      }
      const { data: pros, error: prosError } = await supabase.from("pro_profiles").select("id, business_name").in("id", ids);
      if (prosError) {
        toast({ title: t.auth.toastError, description: prosError.message, variant: "destructive" });
        setSavedPros([]);
        setSavedProsLoading(false);
        return;
      }
      const { data: photos } = await supabase.from("pro_photos").select("pro_profile_id, url, is_primary").in("pro_profile_id", ids);
      const photoByPro: Record<string, string> = {};
      (photos || []).forEach((p: { pro_profile_id: string; url: string; is_primary?: boolean | null }) => {
        if (!photoByPro[p.pro_profile_id]) photoByPro[p.pro_profile_id] = p.url;
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      const list = (pros || [])
        .map((p: { id: string; business_name: string }) => ({
          id: p.id,
          business_name: p.business_name,
          photoUrl: photoByPro[p.id] ?? null,
        }))
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      setSavedPros(list);
      setSavedProsLoading(false);
    })();
  }, [user]);

  const handleUnsaveProFromDashboard = async (proId: string) => {
    if (!user) return;
    const { error } = await supabase.from("client_saved_pros").delete().eq("user_id", user.id).eq("pro_profile_id", proId);
    if (error) {
      toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
      return;
    }
    setSavedPros((prev) => prev.filter((p) => p.id !== proId));
    toast({ title: t.dashboard.savedProRemoved ?? "Removed from saved pros." });
  };

  const handleSubmitClientReview = async () => {
    if (!proProfile || !reviewClientBooking || clientReviewRating < 1) return;
    setClientReviewConfirmOpen(true);
  };

  const clearClientReviewForm = () => {
    revokePhotoPreviewUrls(clientReviewPhotoPreviews);
    setReviewClientBooking(null);
    setClientReviewRating(0);
    setClientReviewContent("");
    setClientReviewPhotos([]);
    setClientReviewPhotoPreviews([]);
  };

  const openReviewProDialog = useCallback(
    async (proProfileId: string) => {
      if (!user?.id) return;
      if (reviewedProIds.has(proProfileId)) {
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description: t.reviews.alreadyReviewedBody,
        });
        return;
      }
      const guard = await canSubmitProReview(proProfileId, user.id);
      if (!guard.ok) {
        setReviewedProIds((prev) => new Set(prev).add(proProfileId));
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description:
            guard.reason === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody,
        });
        return;
      }
      setReviewProForClientId(proProfileId);
    },
    [user?.id, reviewedProIds, toast, t.reviews],
  );

  const openReviewClientDialog = useCallback(
    async (bookingId: string, clientId: string) => {
      if (!proProfile?.id) return;
      if (reviewedClientIds.has(clientId)) {
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description: t.reviews.alreadyReviewedBody,
        });
        return;
      }
      const guard = await canSubmitClientReview(proProfile.id, clientId);
      if (!guard.ok) {
        setReviewedClientIds((prev) => new Set(prev).add(clientId));
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description:
            guard.reason === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody,
        });
        return;
      }
      setReviewClientBooking({ bookingId, clientId });
    },
    [proProfile?.id, reviewedClientIds, toast, t.reviews],
  );

  useEffect(() => {
    if (!user?.id) return;
    const refreshReviewedPros = () => {
      void (async () => {
        const { data, error } = await supabase.from("reviews").select("pro_profile_id").eq("reviewer_id", user.id);
        if (error) return;
        setReviewedProIds(new Set((data || []).map((r: { pro_profile_id: string }) => r.pro_profile_id)));
      })();
    };
    window.addEventListener(REVIEWS_CHANGED_EVENT, refreshReviewedPros);
    return () => window.removeEventListener(REVIEWS_CHANGED_EVENT, refreshReviewedPros);
  }, [user?.id]);

  const handleSubmitClientReviewConfirmed = async () => {
    if (!proProfile || !reviewClientBooking || clientReviewRating < 1 || !user) return;
    setClientReviewConfirmOpen(false);
    setClientReviewSubmitting(true);
    try {
      const guard = await canSubmitClientReview(proProfile.id, reviewClientBooking.clientId);
      if (!guard.ok) {
        toast({
          title: t.reviews.alreadyReviewedTitle,
          description:
            guard.reason === "locked" ? t.reviews.cannotReviewAgain : t.reviews.alreadyReviewedBody,
          variant: "destructive",
        });
        return;
      }
      const baseRow = {
        pro_profile_id: proProfile.id,
        client_id: reviewClientBooking.clientId,
        booking_id: reviewClientBooking.bookingId,
        rating: clientReviewRating,
        content: clientReviewContent.trim() || null,
      };
      let inserted: { id: string } | null = null;
      const withPhotos = await supabase
        .from("client_reviews")
        .insert({ ...baseRow, photo_urls: [] })
        .select("id")
        .single();
      if (withPhotos.error?.message?.includes("photo_urls")) {
        const fallback = await supabase.from("client_reviews").insert(baseRow).select("id").single();
        if (fallback.error) throw fallback.error;
        inserted = fallback.data;
      } else if (withPhotos.error) {
        throw withPhotos.error;
      } else {
        inserted = withPhotos.data;
      }
      if (clientReviewPhotos.length > 0 && inserted?.id) {
        const urls = await uploadClientReviewPhotos(user.id, inserted.id, clientReviewPhotos);
        if (urls.length > 0) {
          await supabase.from("client_reviews").update({ photo_urls: urls }).eq("id", inserted.id);
        }
      }
      toast({ title: t.dashboard.clientReviewSubmitted });
      setReviewedClientIds((prev) => new Set(prev).add(reviewClientBooking.clientId));
      notifyReviewsChanged();
      clearClientReviewForm();
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setClientReviewSubmitting(false);
    }
  };

  const loadReferralInvites = useCallback(async () => {
    const { error: recErr } = await supabase.rpc("reconcile_my_referrals");
    if (recErr) {
      console.warn("[referrals] reconcile_my_referrals:", recErr.message);
    }
    const { data, error } = await referralInvite("list");
    if (error) {
      toast({
        title: locale === "fr" ? "Parrainage indisponible" : "Referrals unavailable",
        description: errorMessage(error),
        variant: "destructive",
      });
      return;
    }
    if (data?.invites) setReferralInvites(data.invites);
  }, [locale, toast]);

  useEffect(() => {
    if (!user) return;
    void loadReferralInvites();
  }, [user, loadReferralInvites]);

  useEffect(() => {
    if (!user) return;
    const bump = () => void loadReferralInvites();
    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, loadReferralInvites]);

  const unlockedReferral = referralInvites.find(isReferralCouponUnlocked);
  const latestReferral = referralInvites[0] ?? null;
  const showReferralFriendAside = Boolean(
    proProfile?.is_verified && proProfile?.referral_invite_panel_enabled !== false && !isAdmin,
  );
  const showAdminAside = Boolean(isAdmin && platformAdminReady);

  const adminFilteredPros = useMemo(() => {
    const q = adminProMemberFilter.trim();
    if (!q) return allPros;
    return allPros.filter((p) => adminPublicUserNumberByUserId[p.user_id]?.includes(q));
  }, [allPros, adminProMemberFilter, adminPublicUserNumberByUserId]);

  const handleCopyReferralRewardCode = async () => {
    const code = unlockedReferral?.reward_code?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: t.dashboard.referralTokenCopied });
      setReferralTokenJustCopied(true);
      window.setTimeout(() => setReferralTokenJustCopied(false), 2000);
    } catch {
      toast({ title: t.auth.toastError ?? "Error", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  const handleConfirmDismissReferralAside = async () => {
    if (!proProfile?.id) {
      setReferralDismissDialogOpen(false);
      return;
    }
    try {
      const { error } = await supabase
        .from("pro_profiles")
        .update({ referral_invite_panel_enabled: false, updated_at: new Date().toISOString() })
        .eq("id", proProfile.id);
      if (error) throw error;
      setProProfile((prev) => (prev ? { ...prev, referral_invite_panel_enabled: false } : prev));
      toast({ title: locale === "fr" ? "Panneau retir?" : "Panel removed" });
      setReferralDismissDialogOpen(false);
    } catch (e) {
      toast({
        title: t.auth.toastError ?? "Error",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleSendReferralInvite = async () => {
    const email = referralEmail.trim();
    if (!email || !email.includes("@")) {
      toast({ title: t.auth.toastError ?? "Error", description: t.dashboard.friendEmailRequired ?? "Enter your friend's email address.", variant: "destructive" });
      return;
    }
    setReferralLoading(true);
    try {
      const { data, error } = await referralInvite("send", { email, language: locale });
      if (error) throw error;
      if (data?.invites) setReferralInvites(data.invites);
      setReferralEmail("");
      toast({
        title: t.dashboard.referralInviteToastTitle ?? "Invitation sent",
        description: t.dashboard.referralInviteToastBody ?? "",
      });
    } catch (error) {
      toast({ title: t.auth.toastError ?? "Error", description: errorMessage(error), variant: "destructive" });
    } finally {
      setReferralLoading(false);
    }
  };

  const handleClaimReferralReward = async () => {
    setReferralClaiming(true);
    try {
      const { data, error } = await referralInvite("claim");
      if (error) throw error;
      if (data?.invites) setReferralInvites(data.invites);
      const planLabel = t.plans?.growth ?? "Growth";
      const dateStr = data?.trial_ends_at
        ? new Date(data.trial_ends_at).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })
        : "";
      toast({
        title: t.dashboard.referralClaimCouponTitle ?? "Coupon applied",
        description: data?.trial_ends_at
          ? (t.dashboard.referralClaimGrowthUntil ?? "{{plan}} is active until {{date}}.")
              .replace("{{plan}}", planLabel)
              .replace("{{date}}", dateStr)
          : (t.dashboard.referralClaimGrowthDaysAdded ?? "14 days of {{plan}} access were added.").replace("{{plan}}", planLabel),
      });
      setProSubscriptionPlanId("growth");
      setProProfile((prev) =>
        prev ? { ...prev, subscription_tier: "growth", referral_invite_panel_enabled: false } : prev
      );
    } catch (error) {
      toast({ title: t.auth.toastError ?? "Error", description: errorMessage(error), variant: "destructive" });
    } finally {
      setReferralClaiming(false);
    }
  };

  const finalizeSquareBookingPayment = async (bookingId: string, action: "complete" | "cancel") => {
    try {
      const { data, error } = await supabase.functions.invoke("square-finalize-payment", {
        body: { booking_id: bookingId, action },
      });
      if (error) {
        console.warn("square-finalize-payment:", error.message);
        return;
      }
      if (data && typeof data === "object" && "error" in data && data.error) {
        console.warn("square-finalize-payment:", (data as { details?: string }).details ?? data.error);
      }
    } catch (e) {
      console.warn("square-finalize-payment:", e);
    }
  };

  const handleDeclineBooking = async () => {
    if (!declineBookingId) return;
    setDeclineSubmitting(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "declined",
          decline_reason: declineReason.trim() || null,
          responded_at: new Date().toISOString(),
          client_unread: true,
          pro_unread: false,
        })
        .eq("id", declineBookingId);
      if (error) throw error;
      await finalizeSquareBookingPayment(declineBookingId, "cancel");
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
      setProBookings((prev) =>
        prev.map((b) =>
          b.id === declineBookingId
            ? {
                ...b,
                status: "declined" as const,
                decline_reason: declineReason.trim() || null,
                responded_at: new Date().toISOString(),
              }
            : b
        )
      );
      refreshBookingNotificationCount();
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
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
          client_unread: true,
          pro_unread: false,
        })
        .eq("id", bookingId);
      if (error) throw error;
      await finalizeSquareBookingPayment(bookingId, "complete");
      toast({ title: t.dashboard.approveSuccess ?? "Booking accepted." });
      setProBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: "accepted", responded_at: new Date().toISOString() } : b
        )
      );
      refreshBookingNotificationCount();
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setApproveSubmitting(false);
      setApproveBookingId(null);
    }
  };

  const handleMarkBookingComplete = async (bookingId: string) => {
    setMarkCompleteBookingId(bookingId);
    setMarkCompleteSubmitting(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "completed", client_unread: true, pro_unread: false })
        .eq("id", bookingId);
      if (error) throw error;
      toast({ title: t.dashboard.markedCompleteToast ?? "Service marked as completed." });
      setProBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "completed" } : b)));
      notifyReviewsChanged();
      refreshBookingNotificationCount();
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setMarkCompleteSubmitting(false);
      setMarkCompleteBookingId(null);
    }
  };

  const saveProfileAvatar = useCallback(
    async (blob: Blob) => {
      if (!user?.id) return;
      try {
        const url = await uploadProfileAvatar(user.id, blob);
        setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
        if (proProfile?.id) {
          await syncProPrimaryPhotoFromAvatar(proProfile.id, user.id, url);
          setProPrimaryPhotoUrl(url);
        }
        toast({ title: t.dashboard.profilePhotoSaved ?? "Profile photo updated" });
      } catch (err) {
        toast({
          title: t.auth.toastError,
          description: (err as Error).message,
          variant: "destructive",
        });
        throw err;
      }
    },
    [user?.id, proProfile?.id, t.auth.toastError, t.dashboard.profilePhotoSaved, toast],
  );

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAccountSaving(true);
    try {
      const phone = formatCanadianPhone(accountForm.phone);
      const birthdayRaw = profile?.birthday ? profile.birthday : accountForm.birthday.trim() || null;
      if (birthdayRaw && !profile?.birthday && !isBirthdayAtLeastMinAge(birthdayRaw)) {
        toast({
          title: t.auth.toastError,
          description: t.dashboard.accountBirthdayMinAge ?? "You must be at least 18 years old.",
          variant: "destructive",
        });
        setAccountSaving(false);
        return;
      }
      const birthday = birthdayRaw;
      const postalNorm = normalizeCanadianPostal(accountForm.postal_code);
      const addressSave = proProfile?.id
        ? (proProfile.business_address?.trim() || accountForm.address.trim() || null)
        : accountForm.address.trim() || null;
      if (postalNorm.length > 0) {
        const geo = await geocodePostalToLocation(postalNorm);
        if (!geo) {
          toast({
            title: t.auth.toastError,
            description: t.dashboard.accountPostalInvalid,
            variant: "destructive",
          });
          setAccountSaving(false);
          return;
        }
        setBrowsePostalLocation({
          postal: postalNorm,
          lat: geo.lat,
          lng: geo.lng,
          city: geo.city,
          province: geo.province,
        });
      } else {
        clearBrowsePostalLocation();
      }
      const { error } = await supabase.from("profiles").update({
        full_name: accountForm.full_name.trim() || null,
        phone: phone || null,
        birthday,
        email_language: accountForm.email_language,
        postal_code: postalNorm || null,
        address: addressSave,
      }).eq("user_id", user.id);
      if (error) throw error;
      const savedName = accountForm.full_name.trim();
      // Keep auth metadata in sync so the header label updates without a full reload.
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { full_name: savedName || null },
      });
      if (metaErr) console.warn(metaErr);
      try {
        window.dispatchEvent(
          new CustomEvent("premiere:profile-updated", { detail: { full_name: savedName } })
        );
      } catch {
        /* ignore */
      }
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: savedName || null,
              phone: phone || null,
              birthday,
              email_language: accountForm.email_language,
              postal_code: postalNorm || null,
              address: addressSave,
            }
          : prev
      );
      setAccountForm((prev) => ({
        ...prev,
        phone,
        birthday: birthday ?? "",
        postal_code: postalNorm || "",
        address: typeof addressSave === "string" ? addressSave : "",
      }));
      if (proProfile?.id) {
        const slug = accountMainCategory.trim() || null;
        const { error: proAccErr } = await supabase
          .from("pro_profiles")
          .update({
            primary_category_slug: slug,
            email_language: accountForm.email_language,
            updated_at: new Date().toISOString(),
            ...(addressSave ? { business_address: addressSave } : {}),
          })
          .eq("id", proProfile.id);
        if (proAccErr) {
          const msg = `${proAccErr.message ?? ""} ${(proAccErr as { details?: string }).details ?? ""}`.toLowerCase();
          const missingCol =
            msg.includes("primary_category_slug") || (msg.includes("schema cache") && msg.includes("pro_profiles"));
          if (missingCol) {
            toast({
              title: t.auth.toastError,
              description: t.dashboard.missingPrimaryCategoryColumn,
              variant: "destructive",
            });
            return;
          }
          throw proAccErr;
        }
        setProProfile((p) => (p ? { ...p, primary_category_slug: slug } : null));
        if (slug) {
          const { error: syncCatErr } = await supabase
            .from("pro_services")
            .update({ category_slug: slug })
            .eq("pro_profile_id", proProfile.id);
          if (syncCatErr) console.warn(syncCatErr);
          setProServices((prev) => prev.map((s) => ({ ...s, category_slug: slug! })));
        }
      }
      toast({ title: t.dashboard.accountSaved });
    } catch (err: unknown) {
      toast({ title: t.auth.toastError, description: (err as Error).message, variant: "destructive" });
    } finally {
      setAccountSaving(false);
    }
  };

  const clientRequestLimit = clientRequestLimitForTier(subscriptionTierNormalized);
  const lockedProBookingIds = useMemo(
    () => lockedClientRequestIds(proBookings, clientRequestLimit),
    [clientRequestLimit, proBookings]
  );
  const proMaySeeClientPhone = useCallback(
    (booking: { id: string; status: string; client_id: string }) => {
      if (!proProfile || lockedProBookingIds.has(booking.id)) return false;
      const phone = clientProfiles[booking.client_id]?.phone;
      if (!phone) return false;
      return booking.status === "accepted" || booking.status === "completed";
    },
    [proProfile, lockedProBookingIds, clientProfiles],
  );
  const proMaySeeClientContactInDetail = useCallback(
    (booking: { id: string; status: string }) => {
      if (lockedProBookingIds.has(booking.id)) return false;
      return booking.status === "accepted" || booking.status === "completed";
    },
    [lockedProBookingIds],
  );

  const openClientBookingPay = useCallback(async (b: (typeof clientBookings)[number]) => {
    const { data } = await supabase
      .from("pro_profiles")
      .select("square_location_id")
      .eq("id", b.pro_profile_id)
      .maybeSingle();
    setPayBookingSquareLoc(
      typeof data?.square_location_id === "string" && data.square_location_id.trim()
        ? data.square_location_id.trim()
        : null,
    );
    setPayBookingTarget(b);
  }, []);
  const lockedAvailableJobIds = useMemo(
    () => lockedClientRequestIds(availableJobs, clientRequestLimit),
    [availableJobs, clientRequestLimit]
  );
  const hasSavedBirthday = Boolean(profile?.birthday);
  const proViewingMyRequests = Boolean(proProfile?.is_verified && searchParams.get("view") === "my-requests");

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

  const showClientRequestUpgradePrompt = () => {
    if (subscriptionTierNormalized == null) {
      toast({
        title: t.dashboard.requestLimitHoldTitle ?? "Subscribe to unlock pro tools",
        description: t.dashboard.requestLimitHoldDesc ?? "",
        onClick: () => navigate("/pro-plans"),
      });
      return;
    }
    if (clientRequestLimit == null) return;
    const currentPlan =
      subscriptionTierNormalized === "starter"
        ? (t.plans?.starter ?? "Starter")
        : (t.plans?.growth ?? "Growth");
    const nextPlan =
      subscriptionTierNormalized === "starter"
        ? (t.plans?.growth ?? "Growth")
        : (t.plans?.pro ?? "Pro");
    const descriptionTemplate =
      t.dashboard.requestLimitUpgradeDesc ??
      "{{plan}} includes access to the first {{limit}} client requests each month. Upgrade to {{nextPlan}} to unlock more.";

    toast({
      title: t.dashboard.requestLimitUpgradeTitle ?? "Upgrade for more client requests?",
      description: descriptionTemplate
        .replace("{{plan}}", currentPlan)
        .replace("{{limit}}", String(clientRequestLimit))
        .replace("{{nextPlan}}", nextPlan),
      onClick: () => navigate("/pro-plans"),
    });
  };

  const proBookingStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return t.dashboard.bookingStatusPending;
      case "accepted":
        return t.dashboard.bookingStatusAccepted;
      case "completed":
        return t.dashboard.bookingStatusCompleted;
      case "declined":
        return t.dashboard.bookingStatusDeclined;
      case "cancelled":
        return t.dashboard.bookingStatusCancelled;
      default:
        return status;
    }
  };

  const renderProBookingRequestCard = (b: (typeof proBookings)[number]) => {
    const isLocked = lockedProBookingIds.has(b.id);
    const serviceLocationMode = proProfile ? profileDefaultMode(proProfile) : "travel";
    return (
      <ProBookingRequestCard
        key={b.id}
        booking={b}
        compactPending={b.status === "pending"}
        serviceLocationMode={serviceLocationMode}
        isLocked={isLocked}
        statusLabel={proBookingStatusLabel(b.status)}
        onLockedClick={showClientRequestUpgradePrompt}
        onApprove={() => handleApproveBooking(b.id)}
        onDecline={() => setDeclineBookingId(b.id)}
        onMarkComplete={() => void handleMarkBookingComplete(b.id)}
        onReviewClient={
          proProfile && b.status === "completed" && !reviewedClientIds.has(b.client_id)
            ? () => void openReviewClientDialog(b.id, b.client_id)
            : undefined
        }
        onUploadProof={
          proProfile && b.status === "completed"
            ? () => {
                setProofUploadBookingId(b.id);
                setProofUploadOpen(true);
              }
            : undefined
        }
        approveSubmitting={approveSubmitting && approveBookingId === b.id}
        markCompleteSubmitting={markCompleteSubmitting && markCompleteBookingId === b.id}
        showReviewButton={Boolean(proProfile && b.status === "completed" && !reviewedClientIds.has(b.client_id))}
        showProofButton={Boolean(proProfile && b.status === "completed")}
        isUnread={b.pro_unread === true}
        onOpenDetail={() => setProBookingDetailId(b.id)}
      />
    );
  };

  const displayJobs = showMoreJobs ? availableJobs : availableJobs.slice(0, 9);
  const hasMoreJobs = availableJobs.length > 9;

  const jobUpText = (createdAt?: string | null) => {
    if (!createdAt) return "";
    const ms = new Date(createdAt).getTime();
    if (Number.isNaN(ms)) return "";
    const diffMs = Date.now() - ms;
    if (diffMs < 0) return "";
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    if (days >= 1) {
      return (t.dashboard.jobUpForDays ?? "Up for {{count}}d").replace("{{count}}", String(days));
    }
    const safeHours = Math.max(1, hours);
    return (t.dashboard.jobUpForHours ?? "Up for {{count}}h").replace("{{count}}", String(safeHours));
  };

  const formatJobRequestBudget = (br: string | null | undefined) => {
    if (!br?.trim()) return "-";
    const sep = t.dashboard.budgetRangeSeparator ?? " – ";
    if (br.includes("-")) return br.split("-").map((v) => `$${v.trim()}`).join(sep);
    return `$${br.trim()}`;
  };

  const timingRequestLabel = (value: string | null | undefined) => {
    const o = TIMING_OPTIONS.find((x) => x.value === value);
    if (!o) return value?.trim() || "?";
    const mk = t.makeRequest as Record<string, string>;
    return mk[o.labelKey] ?? value ?? "?";
  };

  const whenNeededLabel = (job: JobRequest) => {
    const urgency = timingRequestLabel(job.timing);
    const schedule = job.preferred_time_window?.trim() || "";
    const mode = (job.scheduling_mode ?? "").toLowerCase();
    const requestedDate =
      mode === "range"
        ? `${job.range_start_date ? format(parseScheduleDay(job.range_start_date) ?? new Date(job.range_start_date), "PP") : "?"}${job.range_end_date ? ` ? ${format(parseScheduleDay(job.range_end_date) ?? new Date(job.range_end_date), "PP")}` : ""}`
        : mode === "specific_day"
          ? (job.preferred_date ? format(parseScheduleDay(job.preferred_date) ?? new Date(job.preferred_date), "PP") : "")
          : mode === "exact"
            ? formatCustomerExactSlotLine(job)
            : (job.preferred_date ? format(parseScheduleDay(job.preferred_date) ?? new Date(job.preferred_date), "PP") : "");

    const parts = [urgency, requestedDate, schedule].filter((v) => v && v !== "?");
    return parts.length ? parts.join(" ? ") : "?";
  };

  const buildQuoteEstimatedTime = () => {
    if (!selectedJobForQuote) return "";
    if (customerRequestedExactSlot(selectedJobForQuote)) {
      return `${t.dashboard.quoteAgreedSchedule}: ${formatCustomerExactSlotLine(selectedJobForQuote)}`;
    }
    const parts: string[] = [];
    if (quoteEstimatedDate) parts.push(format(quoteEstimatedDate, "PPP"));
    if (quoteTimeFrom && quoteTimeTo) parts.push(`${quoteTimeFrom}?${quoteTimeTo}`);
    else if (quoteTimeFrom) parts.push(quoteTimeFrom);
    if (quoteEstimatedHours) parts.push(`~${quoteEstimatedHours} ${t.dashboard.quoteHoursWork}`);
    return parts.join(" ? ");
  };

  const handleSendQuote = async () => {
    if (!selectedJobForQuote || !proProfile) return;

    const priceNum = parseFloat(quotePrice);
    if (!quotePrice.trim() || Number.isNaN(priceNum) || priceNum <= 0) {
      toast({
        title: t.dashboard.quoteValidationTitle ?? "Price required",
        description: t.dashboard.quotePriceRequired ?? "Enter a valid price greater than zero.",
        variant: "destructive",
      });
      return;
    }
    const budget = parseBudgetRange(selectedJobForQuote.budget_range);
    if (budget.min != null && priceNum < budget.min) {
      toast({
        title: t.dashboard.quoteValidationTitle ?? "Quote",
        description: locale === "fr" ? `Le prix doit ?tre au moins ${budget.min} $.` : `Price must be at least $${budget.min}.`,
        variant: "destructive",
      });
      return;
    }
    if (budget.max != null && priceNum > budget.max) {
      toast({
        title: t.dashboard.quoteValidationTitle ?? "Quote",
        description: locale === "fr" ? `Le prix doit ?tre au plus ${budget.max} $.` : `Price must be at most $${budget.max}.`,
        variant: "destructive",
      });
      return;
    }

    const exactSlot = customerRequestedExactSlot(selectedJobForQuote);
    if (!exactSlot) {
      const mode = (selectedJobForQuote.scheduling_mode ?? "").toLowerCase();
      if (mode === "range" && !quoteEstimatedDate) {
        toast({
          title: t.dashboard.quoteValidationTitle ?? "Date required",
          description: t.dashboard.quotePickDayInRange ?? "Pick a day within the customer?s date range.",
          variant: "destructive",
        });
        return;
      }
      const dayErr = validateProChosenDay(selectedJobForQuote, quoteEstimatedDate);
      if (dayErr) {
        toast({ title: t.dashboard.quoteValidationTitle ?? "Check date", description: dayErr, variant: "destructive" });
        return;
      }
      const bounds = effectiveCustomerTimeBounds(selectedJobForQuote);
      if (bounds && (!quoteTimeFrom.trim() || !quoteTimeTo.trim())) {
        toast({
          title: t.dashboard.quoteValidationTitle ?? "Time window",
          description:
            t.dashboard.quoteEnterArrivalWindow ??
            "Enter your arrival window (from?to) within the customer?s allowed hours.",
          variant: "destructive",
        });
        return;
      }
      const twErr = validateProTimeWindow(selectedJobForQuote, quoteTimeFrom, quoteTimeTo);
      if (twErr) {
        toast({ title: t.dashboard.quoteValidationTitle ?? "Check times", description: twErr, variant: "destructive" });
        return;
      }
    }

    setSendingQuote(true);
    try {
      const estimatedTime = buildQuoteEstimatedTime();
      let insertPayload: Record<string, unknown> = {
        job_request_id: selectedJobForQuote.id,
        pro_profile_id: proProfile.id,
        price_cents: Math.round(priceNum * 100),
        estimated_time: estimatedTime || null,
        proposed_service_date: quoteEstimatedDate
          ? format(quoteEstimatedDate, "yyyy-MM-dd")
          : selectedJobForQuote.preferred_date
            ? String(selectedJobForQuote.preferred_date).slice(0, 10)
            : null,
        message: quoteMessage.trim() || null,
        status: "pending",
        updated_at: new Date().toISOString(),
      };
      let { error } = await supabase.from("job_quotes").insert(insertPayload);
      if (error?.message?.includes("proposed_service_date")) {
        const { proposed_service_date: _drop, ...withoutDate } = insertPayload;
        insertPayload = withoutDate;
        ({ error } = await supabase.from("job_quotes").insert(insertPayload));
      }
      if (error) throw error;
      toast({ title: t.dashboard.quoteSentTitle ?? "Quote sent", description: t.dashboard.quoteSentDesc ?? "The customer will see your quote and can accept or decline." });
      setSelectedJobForQuote(null);
      setQuotePrice("");
      setQuoteEstimatedTime("");
      setQuoteEstimatedDate(undefined);
      setQuoteEstimatedHours("");
      setQuoteTimeFrom("");
      setQuoteTimeTo("");
      setQuoteMessage("");
    } catch (e) {
      toast({ title: t.dashboard.quoteSendFailedTitle ?? "Failed to send quote", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSendingQuote(false);
    }
  };

  const handleSaveEditedJobRequest = async () => {
    if (!editJobRequestId) return;
    setEditReqSubmitting(true);
    try {
      const budgetMinSnap = editReqBudgetMin.trim() ? snapBudgetToTen(editReqBudgetMin) : "";
      const budgetMaxSnap = editReqBudgetMax.trim() ? snapBudgetToTen(editReqBudgetMax) : "";
      const budget_range =
        budgetMinSnap || budgetMaxSnap
          ? [budgetMinSnap, budgetMaxSnap].filter(Boolean).join("-")
          : null;

      const mk = t.makeRequest as Record<string, string>;
      const schedulingFields = schedulingDbFieldsFromFormState(
        {
          availabilityMode: editReqAvailabilityMode,
          preferredTimeWindow: editReqTimeWindow,
          preferredDate: editReqPreferredDate,
          rangeStartDate: editReqRangeStartDate,
          rangeEndDate: editReqRangeEndDate,
          startHour: editReqStartHour,
          endHour: editReqEndHour,
          exactTime: editReqExactTime,
        },
        mk
      );

      const preferredDateForPayload = editReqAvailabilityMode === "range" ? editReqRangeStartDate : editReqPreferredDate;
      const preferredDateString = preferredDateForPayload ? format(preferredDateForPayload, "yyyy-MM-dd") : null;
      const exactDateTime =
        editReqAvailabilityMode === "exact" && editReqPreferredDate && editReqExactTime
          ? createLocalDateTime(editReqPreferredDate, editReqExactTime)
          : null;
      const preferredDatetime = exactDateTime
        ? exactDateTime.toISOString()
        : preferredDateString != null
          ? `${preferredDateString}T12:00:00.000Z`
          : null;

      const payload: Record<string, unknown> = {
        description: editReqDescription.trim(),
        category: editReqCategory.trim() || "Other",
        budget_range,
        timing: editReqTiming.trim() || null,
        preferred_date: preferredDateString,
        preferred_datetime: preferredDatetime,
        preferred_time_window: schedulingFields.preferred_time_window,
        scheduling_mode: schedulingFields.scheduling_mode,
        time_window_code: schedulingFields.time_window_code,
        range_start_date: schedulingFields.range_start_date,
        range_end_date: schedulingFields.range_end_date,
        exact_time: schedulingFields.exact_time,
        window_time_start: schedulingFields.window_time_start,
        window_time_end: schedulingFields.window_time_end,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from("job_requests").update(payload).eq("id", editJobRequestId);
      if (
        error &&
        /scheduling_mode|time_window_code|range_start_date|range_end_date|exact_time|window_time|preferred_datetime|schema cache|column/i.test(
          error.message
        )
      ) {
        const {
          scheduling_mode: _sm,
          time_window_code: _tw,
          range_start_date: _rs,
          range_end_date: _re,
          exact_time: _et,
          window_time_start: _w1,
          window_time_end: _w2,
          preferred_datetime: _pdt,
          ...fallback
        } = payload;
        ({ error } = await supabase.from("job_requests").update(fallback).eq("id", editJobRequestId));
      }
      if (error) throw error;

      setJobRequests((prev) =>
        prev.map((r) =>
          r.id === editJobRequestId
            ? {
                ...r,
                description: payload.description as string,
                category: payload.category as string,
                budget_range: (payload.budget_range as string | null) ?? null,
                timing: (payload.timing as string | null) ?? null,
                preferred_date: (payload.preferred_date as string | null) ?? null,
                preferred_time_window: (payload.preferred_time_window as string | null) ?? null,
                preferred_datetime: (payload.preferred_datetime as string | null) ?? r.preferred_datetime ?? null,
                scheduling_mode: (payload.scheduling_mode as string | null) ?? r.scheduling_mode ?? null,
                time_window_code: (payload.time_window_code as string | null) ?? r.time_window_code ?? null,
                range_start_date: (payload.range_start_date as string | null) ?? r.range_start_date ?? null,
                range_end_date: (payload.range_end_date as string | null) ?? r.range_end_date ?? null,
                exact_time: (payload.exact_time as string | null) ?? r.exact_time ?? null,
                window_time_start: (payload.window_time_start as string | null) ?? r.window_time_start ?? null,
                window_time_end: (payload.window_time_end as string | null) ?? r.window_time_end ?? null,
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

  const deleteClientJobRequest = async (id: string) => {
    if (
      !window.confirm(
        t.dashboard.requestDeleteConfirm ??
          "Delete this service request? Quotes on it will be removed. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingJobRequestId(id);
    try {
      const { error } = await supabase.from("job_requests").delete().eq("id", id);
      if (error) throw error;
      setJobRequests((prev) => prev.filter((r) => r.id !== id));
      setJobQuotesByRequestId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast({
        title: t.dashboard.requestDeleted ?? "Request deleted",
        description: t.dashboard.requestDeletedDesc ?? "Your service request was removed.",
      });
      if (editJobRequestId === id) setEditJobRequestId(null);
    } catch (e) {
      toast({ title: t.auth.toastError ?? "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDeletingJobRequestId(null);
    }
  };

  const handleAcceptQuoteAfterPayment = async () => {
    if (!quotePaymentTarget) return;
    const q = quotePaymentTarget.quote;
    const reqId = quotePaymentTarget.requestId;
    setAcceptQuoteId(q.id);
    const { error } = await supabase
      .from("job_quotes")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", q.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setAcceptQuoteId(null);
      return;
    }
    toast({ title: "Quote accepted", description: "Payment successful. The quote is now accepted." });
    setJobQuotesByRequestId((prev) => ({
      ...prev,
      [reqId]: (prev[reqId] ?? []).map((x) => (x.id === q.id ? { ...x, status: "accepted" } : x)),
    }));
    setQuotePaymentTarget(null);
    setQuotePaymentError(null);
    setAcceptQuoteId(null);
  };

  return (
    <Layout>
      <AlertDialog open={referralDismissDialogOpen} onOpenChange={setReferralDismissDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.dashboard.referralDismissPanelTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.dashboard.referralDismissPanelDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <Button type="button" onClick={() => void handleConfirmDismissReferralAside()}>
              {t.dashboard.referralDismissPanelConfirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gradient-page dark:text-white flex flex-col items-center w-full">
      <div
        className={`relative w-full py-8 md:py-12 px-4 md:px-6 ${showReferralFriendAside || showAdminAside ? "lg:pl-80 lg:pr-80" : ""}`}
      >
      {showAdminAside && (
        <aside className="hidden lg:block fixed left-4 top-24 z-30 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-amber-500/30 bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-700 dark:text-amber-400">
              <Shield size={22} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground">{t.dashboard.adminAsideTitle ?? "Platform admin"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.adminAsideBlurb ?? "Shortcuts to admin tools."}</p>
            </div>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <Button type="button" variant="outline" className="justify-start" onClick={() => setDashboardTab("admin")}>
              {t.dashboard.admin ?? "Admin"}
            </Button>
            <Button type="button" variant="outline" className="justify-start" asChild>
              <Link to="/admin/trial-tokens">{t.dashboard.adminTrialLinks ?? "Trial links"}</Link>
            </Button>
            <Button type="button" variant="outline" className="justify-start" asChild>
              <Link to="/admin/issue-reports">{t.dashboard.adminIssueReports ?? "Issue reports"}</Link>
            </Button>
            <Button type="button" variant="outline" className="justify-start" asChild>
              <Link to="/admin/accept-pros">{t.dashboard.adminAcceptProsTitle ?? "Accept pros"}</Link>
            </Button>
            <Button type="button" variant="outline" className="justify-start" asChild>
              <Link to="/admin/job-requests">{t.dashboard.adminJobRequestsNav ?? "Job requests"}</Link>
            </Button>
            <div className="pt-2 border-t border-border/60">
              <WhatsNewMenu items={whatsNewItems} variant="desktop" className="w-full justify-start" />
            </div>
          </nav>
        </aside>
      )}
      {showReferralFriendAside && (
        <aside className="hidden lg:block fixed left-4 top-24 z-30 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-orange-500/10 p-4 pr-10">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
              onClick={() => setReferralDismissDialogOpen(true)}
              aria-label={locale === "fr" ? "Retirer le panneau" : "Remove invite panel"}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-primary/15 blur-2xl" aria-hidden />
            <div className="relative flex items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Gift size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading font-bold text-foreground">
                  {locale === "fr" ? "Invitez un ami" : "Invite a friend"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.referralBlurb}</p>
              </div>
            </div>

            <div className="relative mt-4 overflow-hidden rounded-xl border border-dashed border-primary/35 bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {unlockedReferral ? t.dashboard.referralCouponUnlocked : t.dashboard.referralCouponHidden}
              </p>
              <div className="mt-2 flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 font-mono text-sm font-semibold tracking-tight break-all text-foreground sm:text-base">
                  {unlockedReferral
                    ? unlockedReferral.reward_code?.trim() || EM_DASH
                    : HIDDEN_COUPON_MASK}
                </p>
                <div className="flex shrink-0 items-start gap-2">
                  {unlockedReferral?.reward_code?.trim() ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => void handleCopyReferralRewardCode()}
                      aria-label={t.dashboard.referralCopyToken}
                      title={t.dashboard.referralCopyToken}
                    >
                      {referralTokenJustCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  ) : null}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary/15">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.75)_0%,rgba(255,255,255,.15)_45%,rgba(0,0,0,.08)_100%)]" />
                    <div className="absolute -right-2 -top-2 h-11 w-11 rotate-45 rounded-sm bg-background shadow-xl ring-1 ring-border" />
                    <div className="absolute right-1 top-1 h-7 w-7 rotate-45 rounded-sm bg-primary/20 shadow-inner" />
                  </div>
                </div>
              </div>
              {!unlockedReferral ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {latestReferral?.status === "pending"
                    ? (t.dashboard.referralWaitingEmailConfirm ?? "Waiting for {email}.").replace("{email}", latestReferral.invitee_email)
                    : t.dashboard.referralCodeStaysHidden}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">{t.dashboard.referralUnlockedStaysVisible}</p>
              )}
            </div>

            <form
              className="relative mt-4 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSendReferralInvite();
              }}
            >
              <Input
                type="email"
                value={referralEmail}
                onChange={(event) => setReferralEmail(event.target.value)}
                placeholder={locale === "fr" ? "ami@exemple.ca" : "friend@example.ca"}
                className="bg-background"
              />
              <Button type="submit" disabled={referralLoading} className="w-full gap-2">
                {referralLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {locale === "fr" ? "Envoyer" : "Send"}
              </Button>
            </form>

            {unlockedReferral ? (
              <Button type="button" onClick={handleClaimReferralReward} disabled={referralClaiming} className="relative mt-3 w-full gap-2">
                {referralClaiming ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
                {t.dashboard.adminApplyGrowthDays ?? "Apply 14 Growth days"}
              </Button>
            ) : null}
          </div>
        </aside>
      )}
      <div className="w-full max-w-4xl container mx-auto">
        <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground dark:text-white mb-3 md:mb-4 text-center">
          {t.dashboard.title}
        </h1>
        {proProfile && !isAdminDashboardShell && user?.id ? (
          <div className="mb-6 md:mb-8 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const seg = segmentForTab(shellTab) ?? "account";
                replayDashTour(seg);
              }}
            >
              <HelpCircle size={14} aria-hidden />
              {locale === "fr" ? "Guide de cette page" : "Guide this page"}
            </Button>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link to="/help/dashboard-guide">
                {t.footer.dashboardGuide ?? (locale === "fr" ? "Guide du tableau de bord" : "Dashboard guide")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mb-6 md:mb-8" />
        )}

        {proProfile && !proProfile.is_verified && !proProfileLoading && !isAdminDashboardShell && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6 space-y-3">
            <p className="text-sm font-medium text-foreground">{t.dashboard.pendingProApproval}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.dashboard.pendingProApprovalHint}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.dashboard.pendingProApprovalRequiresTier}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.dashboard.pendingProApprovalAfterAccept}</p>
            <LiquidButton type="button" variant="secondary" size="sm" whiteUntilHover className="w-fit" onClick={() => setProProfileEditorOpen(true)}>
              {t.joinPros.editProfile}
            </LiquidButton>
          </div>
        )}

        <Tabs value={shellTab} onValueChange={setDashboardTab} className="relative z-0 w-full">
          <div className="relative z-0 mb-6 w-full max-w-4xl mx-auto px-1 sm:px-0">
            {dashboardDockReady ? (
              <Dock items={dashboardDockItems} />
            ) : (
              <div
                className="flex h-[84px] md:h-[80px] items-center justify-center"
                aria-busy="true"
                aria-label={t.common?.loading ?? "Loading"}
              >
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            )}
          </div>

          {!isAdminDashboardShell && proProfile?.is_verified && (
            <TabsContent value="pro" className="space-y-4">
              {proProfileLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <ClickableProfileAvatar
                        className="h-20 w-20"
                        src={proPrimaryPhotoUrl ?? profile?.avatar_url}
                        alt={proProfile.business_name}
                        fallback={(profile?.full_name ?? proProfile.business_name).slice(0, 2).toUpperCase()}
                        onSave={saveProfileAvatar}
                      />
                      <div>
                        <h2 className="font-heading text-xl font-bold text-foreground">{proProfile.business_name}</h2>
                        <p className="text-muted-foreground">{profile?.full_name ?? ""}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6" data-tour="pro-stats">
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
                            : "?"}
                        </p>
                        <p className="text-sm text-muted-foreground">{t.dashboard.topPercent}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-6 md:p-8" data-tour="pro-avatar-square">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex gap-3">
                        <div className="rounded-lg bg-muted p-3 shrink-0">
                          <Wallet className="h-6 w-6 text-foreground" aria-hidden />
                        </div>
                        <div>
                          <h3 className="font-heading font-bold text-foreground mb-1">{t.dashboard.squarePaymentsHeading}</h3>
                          <p className="text-sm text-muted-foreground max-w-prose">
                            {proProfile.square_location_id
                              ? t.dashboard.squarePaymentsConnected
                              : t.dashboard.squarePaymentsNotConnected}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        {proProfile.square_location_id ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={squareConnectLoading}
                            onClick={() => void handleSquareDisconnect()}
                          >
                            {squareConnectLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {t.dashboard.squareDisconnectButton}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            disabled={squareConnectLoading}
                            onClick={() => void handleSquareConnect()}
                          >
                            {squareConnectLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t.dashboard.squareConnectButton}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border bg-card p-4 sm:p-6 md:p-8" data-tour="pro-featured">
                    <h3 className="font-heading font-bold text-foreground mb-2">{t.dashboard.featuredProfileDesign ?? "Featured profile design"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.dashboard.proPageAestheticHint ?? "Change your template, background and colors. Clients will see these on your public page."}
                    </p>
                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
                      <div className="min-w-0 space-y-4">
                        <div className={canEditFeaturedProfileDesign ? "min-w-0" : "min-w-0 opacity-40 blur-[1px]"}>
                          <p className="text-sm font-medium text-foreground mb-1">{t.createPro.colorSchemeLabel ?? "Color scheme"}</p>
                          <p className="text-xs text-muted-foreground mb-2">{t.createPro.colorSchemeHint ?? "Pick a palette. Preview updates immediately."} The primary color is used for the right sidebar (Starting price, Booking Guarantee, Availability) on your public page and the mock phone.</p>
                          <div className="sm:hidden">
                            {(() => {
                              const selectedScheme = getSchemeById(proPageColorSchemeId) ?? PRO_PAGE_COLOR_SCHEMES[0];
                              const selectedLabel =
                                (t.createPro as Record<string, string>)[`scheme${selectedScheme.id.charAt(0).toUpperCase()}${selectedScheme.id.slice(1)}`] ??
                                selectedScheme.id;

                              return (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setMobileColorSchemeOpen((open) => !open)}
                                    className="relative min-h-12 w-full overflow-hidden rounded-lg border border-foreground/30 px-3 py-2 text-left text-sm font-semibold text-white shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    style={{
                                      background: `linear-gradient(135deg, ${selectedScheme.primary} 0%, ${selectedScheme.secondary} 62%, ${selectedScheme.accent} 160%)`,
                                    }}
                                    aria-expanded={mobileColorSchemeOpen}
                                  >
                                    <span className="absolute inset-0 bg-black/20" />
                                    <span className="relative z-10 flex items-center justify-between gap-2">
                                      <span className="truncate drop-shadow-sm">{selectedLabel}</span>
                                      <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-950">
                                        {locale === "fr" ? "Changer" : "Change"}
                                      </span>
                                    </span>
                                  </button>

                                  {mobileColorSchemeOpen ? (
                                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-xl">
                                      <div className="space-y-2">
                                        {PRO_PAGE_COLOR_SCHEMES.map((scheme) => {
                                          const isSelected = proPageColorSchemeId === scheme.id;
                                          const label =
                                            (t.createPro as Record<string, string>)[`scheme${scheme.id.charAt(0).toUpperCase()}${scheme.id.slice(1)}`] ??
                                            scheme.id;
                                          return (
                                            <button
                                              key={scheme.id}
                                              type="button"
                                              onClick={() => {
                                                if (!canEditFeaturedProfileDesign) {
                                                  toast({
                                                    title: (
                                                      <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                                                        {t.dashboard.upgradeToGrowthTier ?? "Upgrade to Growth tier?"}
                                                      </span>
                                                    ),
                                                    description: t.dashboard.managePlanToast ?? "Manage your plan ? Upgrade or downgrade anytime.",
                                                    onClick: () => navigate("/pro-plans"),
                                                  });
                                                  return;
                                                }
                                                setProPageColorSchemeId(scheme.id);
                                                setProPagePrimaryColor(scheme.primary);
                                                setProPageSecondaryColor(scheme.secondary);
                                                setProPageAccentColor(scheme.accent);
                                                setProPageBackgroundColor(scheme.background);
                                                setMobileColorSchemeOpen(false);
                                              }}
                                              className={`relative min-h-11 w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm font-semibold text-white ${
                                                isSelected ? "border-foreground ring-2 ring-foreground/40" : "border-white/20"
                                              }`}
                                              style={{
                                                background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.secondary} 62%, ${scheme.accent} 160%)`,
                                              }}
                                            >
                                              <span className="absolute inset-0 bg-black/20" />
                                              <span className="relative z-10 flex items-center justify-between gap-2">
                                                <span className="truncate drop-shadow-sm">{label}</span>
                                                {isSelected ? (
                                                  <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-950">
                                                    {locale === "fr" ? "Choisi" : "Selected"}
                                                  </span>
                                                ) : null}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-2">
                            {PRO_PAGE_COLOR_SCHEMES.map((scheme) => {
                              const isSelected = proPageColorSchemeId === scheme.id;
                              const label =
                                (t.createPro as Record<string, string>)[`scheme${scheme.id.charAt(0).toUpperCase()}${scheme.id.slice(1)}`] ??
                                scheme.id;
                              return (
                                <button
                                  key={scheme.id}
                                  type="button"
                                  onClick={() => {
                                    if (!canEditFeaturedProfileDesign) {
                                      toast({
                                        title: (
                                          <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                                            {t.dashboard.upgradeToGrowthTier ?? "Upgrade to Growth tier?"}
                                          </span>
                                        ),
                                        description: t.dashboard.managePlanToast ?? "Manage your plan ? Upgrade or downgrade anytime.",
                                        onClick: () => navigate("/pro-plans"),
                                      });
                                      return;
                                    }
                                    setProPageColorSchemeId(scheme.id);
                                    setProPagePrimaryColor(scheme.primary);
                                    setProPageSecondaryColor(scheme.secondary);
                                    setProPageAccentColor(scheme.accent);
                                    setProPageBackgroundColor(scheme.background);
                                  }}
                                  className={`group relative min-h-12 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                    isSelected ? "border-foreground ring-2 ring-foreground/40 ring-offset-2 ring-offset-background" : "border-white/20"
                                  }`}
                                  style={{
                                    background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.secondary} 62%, ${scheme.accent} 160%)`,
                                  }}
                                  aria-pressed={isSelected}
                                >
                                  <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
                                  <span className="relative z-10 flex items-center justify-between gap-2">
                                    <span className="truncate drop-shadow-sm">{label}</span>
                                    {isSelected ? (
                                      <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-950">
                                        {locale === "fr" ? "Choisi" : "Selected"}
                                      </span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">{t.dashboard.serviceTags ?? "Service tags"}</p>
                          <p className="text-xs text-muted-foreground mb-2">{t.dashboard.serviceTagsHint ?? "e.g. Emergency Repair, Commercial Work. Shown on your public page."}</p>
                          <div className="flex max-w-full flex-wrap gap-2 overflow-hidden">
                            {SERVICE_TAG_OPTIONS.map((tag) => (
                              <label key={tag} className="inline-flex max-w-full cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={proServiceTags.includes(tag)}
                                  onChange={(e) => {
                                    if (e.target.checked) setProServiceTags((prev) => [...prev, tag]);
                                    else setProServiceTags((prev) => prev.filter((t) => t !== tag));
                                  }}
                                  className="rounded border-input"
                                />
                                <span className="min-w-0 break-words text-sm text-foreground">{tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={canEditFeaturedProfileDesign ? "min-w-0 space-y-3" : "min-w-0 space-y-3 pointer-events-none opacity-40 blur-[1px]"}>
                        <p className="text-sm font-medium text-foreground">{t.dashboard.proPagePreview ?? "Live preview"}</p>
                        <div
                          className={cn(
                            "content-panel rounded-xl p-3 sm:p-4 text-sm space-y-3 md:min-h-[480px] flex flex-col items-center justify-start overflow-hidden",
                            previewSiteTheme === "dark" ? "bg-neutral-900/80" : "bg-muted/40",
                          )}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-center md:hidden"
                            onClick={() => setMobileDesignPreviewOpen(true)}
                          >
                            {t.dashboard.mobileFullScreenPreview}
                          </Button>
                          <div className="hidden w-full md:block">
                            <ProPagePhonePreview
                              template="classic"
                              primaryColor={proPagePrimaryColor}
                              secondaryColor={proPageSecondaryColor}
                              accentColor={proPageAccentColor}
                              backgroundColor={proPageBackgroundColor}
                              businessName={proProfile.business_name}
                              fullName={profile?.full_name ?? undefined}
                              ratingLabel={proStats.reviewCount > 0 ? String(Math.round((proStats.leads || 5) * 10) / 10) : "5.0"}
                              siteTheme={previewSiteTheme}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-center gap-2"
                            onClick={() => {
                              const publicPath = `/pros/${proProfile.id}`;
                              const isDesktop =
                                typeof window !== "undefined" &&
                                window.matchMedia("(min-width: 768px)").matches;
                              if (isDesktop) {
                                window.open(publicPath, "_blank", "noopener,noreferrer");
                              } else {
                                window.open(
                                  `/phone-preview?path=${encodeURIComponent(publicPath)}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }
                            }}
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

                  <Dialog open={mobileDesignPreviewOpen} onOpenChange={setMobileDesignPreviewOpen}>
                    <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none overflow-hidden rounded-[2rem] border-[6px] border-neutral-950 bg-neutral-950 p-1 shadow-2xl md:hidden">
                      <DialogTitle className="sr-only">{t.dashboard.mobileFeaturedPreviewTitle}</DialogTitle>
                      <div
                        className="flex h-full flex-col overflow-y-auto rounded-[1.5rem]"
                        style={{ background: `linear-gradient(180deg, ${proPageBackgroundColor} 0%, ${proPageBackgroundColor} 55%, ${proPagePrimaryColor}22 100%)` }}
                      >
                        <div
                          className="px-5 pb-8 pt-12 text-white"
                          style={{
                            background: `linear-gradient(145deg, ${proPagePrimaryColor}, ${proPageSecondaryColor})`,
                          }}
                        >
                          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-white/75">
                            {t.dashboard.mobilePreviewBrandBadge}
                          </p>
                          <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/20 text-2xl font-bold">
                              {mobilePreviewInitials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h2 className="truncate font-heading text-2xl font-bold">{proProfile.business_name}</h2>
                              <p className="text-sm text-white/80">
                                {(t.dashboard.mobilePreviewSubtitle ?? "{{name}} ? Verified Pro").replace(
                                  "{{name}}",
                                  (profile?.full_name ?? proProfile.business_name).trim() || proProfile.business_name
                                )}
                              </p>
                              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                                <Star size={13} />{" "}
                                {(t.dashboard.mobilePreviewReviewsLine ?? "{{rating}} ? {{count}} reviews")
                                  .replace("{{rating}}", mobilePreviewRatingLabel)
                                  .replace("{{count}}", String(proStats.reviewCount))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 p-5 text-neutral-950">
                          <section className="rounded-2xl bg-white/90 p-4 shadow-sm">
                            <h3 className="font-heading text-lg font-semibold">
                              {(t.dashboard.mobilePreviewAboutTitle ?? "About {{name}}").replace(
                                "{{name}}",
                                proProfile.business_name
                              )}
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-neutral-700">{t.dashboard.mobilePreviewAboutBody}</p>
                          </section>

                          <section className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl p-4 text-white shadow-sm" style={{ backgroundColor: proPagePrimaryColor }}>
                              <p className="text-xs text-white/75">{t.dashboard.mobilePreviewStartingPrice}</p>
                              <p className="mt-1 text-xl font-bold">$75</p>
                            </div>
                            <div className="rounded-2xl p-4 text-white shadow-sm" style={{ backgroundColor: proPageSecondaryColor }}>
                              <p className="text-xs text-white/75">{t.dashboard.mobilePreviewResponse}</p>
                              <p className="mt-1 text-xl font-bold">{t.dashboard.mobilePreviewResponseFast}</p>
                            </div>
                          </section>

                          <section className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: proPageAccentColor }}>
                            <h3 className="font-heading text-lg font-semibold text-neutral-950">{t.dashboard.mobilePreviewServices}</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {[
                                t.dashboard.mobilePreviewServiceTag1,
                                t.dashboard.mobilePreviewServiceTag2,
                                t.dashboard.mobilePreviewServiceTag3,
                              ].map((label, idx) => (
                                <span
                                  key={`preview-svc-${idx}`}
                                  className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-neutral-800"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </section>

                          <Button type="button" className="w-full" onClick={() => setMobileDesignPreviewOpen(false)}>
                            {t.dashboard.mobilePreviewClose}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="rounded-xl border bg-card p-6 md:p-8" data-tour="pro-services">
                    <h3 className="font-heading font-bold text-foreground mb-2">{t.dashboard.myServices ?? "My Services"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t.dashboard.addService ?? "Add service"}, {t.dashboard.editService ?? "Edit service"}, {t.dashboard.setPrice ?? "Set price"}, {t.dashboard.setDuration ?? "Set duration"}.
                      {hasGrowthServiceExtras(subscriptionTierNormalized)
                        ? ` ${t.dashboard.autoReplyGrowthHint ?? ""} ${t.dashboard.renewalGrowthHint ?? ""}`
                        : ` ${t.dashboard.serviceBundlesComingSoon ?? ""}`}
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
                          className={`max-w-[120px] ${INPUT_NO_NUMBER_SPIN}`}
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
                          const catalogEn = catalogEnNameForProService(s.category_slug, s.service_slug, serviceCategories);
                          const serviceName = labelProService(s, locale, catalogEn);
                          const priceValue = s.custom_price_min != null ? s.custom_price_min : s.custom_price_max;
                          const priceStr = priceValue != null ? `$${priceValue}` : null;
                          const dur = formatDurationLabel(s.duration_minutes);
                          return (
                            <li key={`${s.category_slug}-${s.service_slug}`} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border/50 text-sm">
                              <div>
                                <span className="font-medium text-foreground">{serviceName}</span>
                                {dur ? <span className="text-muted-foreground"> · {dur}</span> : null}
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
                    {serviceBundles.length > 0 && (
                      <div className="mb-6 rounded-lg border border-border/80 bg-muted/30 p-4">
                        <h4 className="font-semibold text-foreground mb-2">{t.dashboard.serviceBundlesHeading ?? "Bundles"}</h4>
                        <ul className="space-y-2 text-sm">
                          {serviceBundles.map((bundle) => (
                            <li key={bundle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/80 px-3 py-2 border border-border/60">
                              <div>
                                <span className="font-medium">{bundle.name}</span>
                                <span className="text-muted-foreground text-xs block mt-0.5">
                                  {bundle.items
                                    .map((it) => {
                                      const catalogEn = catalogEnNameForProService(it.category_slug, it.service_slug, serviceCategories);
                                      return labelProService({ service_slug: it.service_slug, display_name: null }, locale, catalogEn);
                                    })
                                    .join(" ? ")}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={async () => {
                                  if (!proProfile?.id) return;
                                  const { error } = await supabase.from("service_bundles").delete().eq("id", bundle.id);
                                  if (error) toast({ title: t.auth?.toastError ?? "Error", description: error.message, variant: "destructive" });
                                  else {
                                    setServiceBundles((prev) => prev.filter((x) => x.id !== bundle.id));
                                    toast({ title: t.dashboard.saved ?? "Saved" });
                                  }
                                }}
                              >
                                {t.dashboard.bundleDelete ?? "Delete"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button type="button" size="sm" className="gap-1" onClick={openAddServiceDialog}>
                        <Plus size={14} /> {t.dashboard.addService ?? "Add service"}
                      </Button>
                      {hasGrowthServiceExtras(subscriptionTierNormalized) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBundleFormName("");
                            setBundleFormKeys([]);
                            setBundleDialogOpen(true);
                          }}
                        >
                          {t.dashboard.createServiceBundle ?? "Create service bundle"}
                        </Button>
                      ) : (
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
                              description: t.dashboard.managePlanToast ?? "Manage your plan ? Upgrade or downgrade anytime.",
                              onClick: () => navigate("/pro-plans"),
                            })
                          }
                        >
                          {t.dashboard.createServiceBundle ?? "Create service bundle"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {proProfile?.id ? (
                    <div data-tour="pro-portfolio">
                      <ProPortfolioEditor proProfileId={proProfile.id} />
                    </div>
                  ) : null}
                  <div className="flex justify-center">
                    <DashboardTourHelpButton onClick={() => replayDashTour("pro")} />
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-700 text-white [&_label]:text-white [&_input]:bg-neutral-800 [&_input]:border-neutral-600 [&_textarea]:bg-neutral-800 [&_textarea]:border-neutral-600 [&_select]:bg-neutral-800 [&_select]:border-neutral-600 [&_select]:text-white">
              <DialogHeader>
                <DialogTitle>{serviceDialogEditing ? (t.dashboard.editService ?? "Edit service") : (t.dashboard.addService ?? "Add service")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {serviceDialogEditing ? (
                  <p className="text-sm text-neutral-300">
                    {getServiceName(serviceDialogEditing.service_slug, locale, serviceDialogEditing.service_slug)}
                    {proProfile?.primary_category_slug
                      ? (() => {
                          const c = serviceCategories.find((x) => x.slug === proProfile.primary_category_slug);
                          return c ? ` ? ${getCategoryName(c, locale)}` : "";
                        })()
                      : ""}
                  </p>
                ) : (
                  <>
                    {proProfile?.primary_category_slug ? (
                      <p className="text-xs text-neutral-400">
                        {t.dashboard.servicesLockedToCategory ?? "New services use your main category from My account:"}{" "}
                        {(() => {
                          const c = serviceCategories.find((x) => x.slug === proProfile.primary_category_slug);
                          return c ? getCategoryName(c, locale) : proProfile.primary_category_slug;
                        })()}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-300">
                        {t.dashboard.setMainCategoryFirst ?? "Choose your main service category in My account before adding a service."}
                      </p>
                    )}
                    <div>
                      <Label>{t.dashboard.serviceLabel ?? "Service"}</Label>
                      <select
                        value={serviceFormService}
                        onChange={(e) => setServiceFormService(e.target.value)}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                        disabled={!proProfile?.primary_category_slug?.trim() || addServiceSelectOptions.length === 0}
                      >
                        <option value="">{t.dashboard.selectService ?? "Select service"}</option>
                        {addServiceSelectOptions.map((s) => (
                          <option key={s.slug} value={s.slug}>
                            {getServiceName(s.slug, locale, s.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <Label>{t.createPro?.personalizedServiceName ?? "Service name"}</Label>
                  <Input
                    value={serviceFormDisplayName}
                    onChange={(e) => setServiceFormDisplayName(e.target.value)}
                    placeholder={t.createPro?.personalizedNamePlaceholder ?? "e.g. Phone repair"}
                    className="mt-1 text-white placeholder:text-white/60"
                  />
                </div>
                <div>
                  <Label>{t.dashboard.setPrice ?? "Price ($)"}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={serviceFormPriceMin}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, "");
                      setServiceFormPriceMin(digitsOnly);
                    }}
                    className={`mt-1 text-white placeholder:text-white/60 ${INPUT_NO_NUMBER_SPIN}`}
                  />
                </div>
                <div className="space-y-3 rounded-md border border-neutral-600 bg-neutral-800/50 p-3">
                  <div>
                    <Label>{locale === "fr" ? "Frais d’annulation ?" : "Cancellation fee?"}</Label>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {locale === "fr"
                        ? "Si oui, le client voit cette règle avant de réserver. Ex. massage 60 $ + frais 20 $ si annulation moins de 24 h → remboursement d’environ 40 $ (si déjà payé via Square)."
                        : "If yes, clients see this before booking. E.g. $60 massage + $20 fee if cancel under 24h → about $40 refunded (if already paid via Square)."}
                    </p>
                    <select
                      value={serviceFormCancelPolicy}
                      onChange={(e) => setServiceFormCancelPolicy(e.target.value as "free" | "late_fee" | "no_cancel")}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                    >
                      <option value="free">{locale === "fr" ? "Non — annulation gratuite" : "No — free cancellation"}</option>
                      <option value="late_fee">
                        {locale === "fr" ? "Oui — frais si annulation moins de 24 h" : "Yes — fee if cancel less than 24h before"}
                      </option>
                      <option value="no_cancel">
                        {locale === "fr" ? "Aucune annulation (frais complets)" : "No cancellation (full charge)"}
                      </option>
                    </select>
                  </div>
                  {serviceFormCancelPolicy === "late_fee" ? (
                    <>
                      <div>
                        <Label>{locale === "fr" ? "Type de frais" : "Fee type"}</Label>
                        <select
                          value={serviceFormCancelFeeType}
                          onChange={(e) => setServiceFormCancelFeeType(e.target.value as "percent" | "fixed")}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                        >
                          <option value="fixed">{locale === "fr" ? "Montant fixe ($)" : "Fixed amount ($)"}</option>
                          <option value="percent">{locale === "fr" ? "Pourcentage du prix" : "Percent of price"}</option>
                        </select>
                      </div>
                      {serviceFormCancelFeeType === "fixed" ? (
                        <div>
                          <Label>{locale === "fr" ? "Montant des frais ($)" : "Fee amount ($)"}</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="20"
                            value={serviceFormCancelFeeDollars}
                            onChange={(e) => setServiceFormCancelFeeDollars(e.target.value.replace(/[^0-9]/g, ""))}
                            className={`mt-1 text-white placeholder:text-white/60 ${INPUT_NO_NUMBER_SPIN}`}
                          />
                          {serviceFormPriceMin.trim() && serviceFormCancelFeeDollars.trim() ? (
                            <p className="text-xs text-neutral-400 mt-1">
                              {locale === "fr"
                                ? `Si le client a payé ${serviceFormPriceMin} $ et annule moins de 24 h : conservez ${serviceFormCancelFeeDollars} $, remboursez environ ${Math.max(0, parseInt(serviceFormPriceMin, 10) - parseInt(serviceFormCancelFeeDollars || "0", 10))} $.`
                                : `If client paid $${serviceFormPriceMin} and cancels under 24h: keep $${serviceFormCancelFeeDollars}, refund about $${Math.max(0, parseInt(serviceFormPriceMin, 10) - parseInt(serviceFormCancelFeeDollars || "0", 10))}.`}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <Label>{locale === "fr" ? "Pourcentage" : "Percent"}</Label>
                          <select
                            value={serviceFormCancelFeePercent}
                            onChange={(e) => setServiceFormCancelFeePercent(Number(e.target.value) as 25 | 50 | 75)}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                          >
                            <option value={25}>25%</option>
                            <option value={50}>50%</option>
                            <option value={75}>75%</option>
                          </select>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
                <div>
                  <Label>{t.dashboard.durationMinutes ?? "Duration (minutes)"}</Label>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {t.dashboard.durationMinutesHint ??
                      "Input the duration in minutes. Anything above 2 hours will be rounded and shown in hours."}
                  </p>
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={formatDurationFieldValue(serviceFormDurationMins)}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") {
                        setServiceFormDurationMins(null);
                        return;
                      }
                      setServiceFormDurationMins(parseDurationDigits(v));
                    }}
                    placeholder="e.g. 60"
                    className={`mt-1 text-white placeholder:text-white/60 ${INPUT_NO_NUMBER_SPIN}`}
                  />
                </div>
                <div>
                  <Label>{t.dashboard.descriptionOptional ?? "Description (optional)"}</Label>
                  <Textarea
                    placeholder={t.dashboard.briefDescription ?? "Brief description"}
                    value={serviceFormDescription}
                    onChange={(e) => setServiceFormDescription(e.target.value)}
                    rows={2}
                    className="mt-1 resize-none text-white placeholder:text-white/60"
                  />
                </div>
                {proProfile ? (
                  <div className="space-y-3">
                    <div>
                      <Label>{t.dashboard.serviceLocationMode ?? "Where is this service offered?"}</Label>
                      <select
                        value={serviceFormLocationMode}
                        onChange={(e) => {
                          const v = e.target.value as ServiceLocationMode;
                          setServiceFormLocationMode(v);
                          if (!serviceModeNeedsWorkspaceAddress(v)) {
                            setServiceFormWorkspaceLat(null);
                            setServiceFormWorkspaceLng(null);
                          }
                        }}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-white mt-1"
                      >
                        <option value="workspace">{t.dashboard.serviceLocationWorkspace ?? "At my workspace only"}</option>
                        <option value="travel">{t.dashboard.serviceLocationTravel ?? "I travel to clients only"}</option>
                        <option value="both">{t.dashboard.serviceLocationBoth ?? "Both (workspace and travel to clients)"}</option>
                      </select>
                    </div>
                    {serviceModeNeedsWorkspaceAddress(serviceFormLocationMode) ? (
                      <div>
                        <Label>{t.dashboard.serviceWorkspaceAddress}</Label>
                        <p className="text-xs text-neutral-400 mt-0.5">{t.dashboard.serviceWorkspaceAddressHint}</p>
                        <AddressInput
                          value={serviceFormWorkspaceAddress}
                          onChange={(v) => {
                            setServiceFormWorkspaceAddress(v);
                            setServiceFormWorkspaceLat(null);
                            setServiceFormWorkspaceLng(null);
                          }}
                          placeholder={t.createPro?.businessAddressInvoicePlaceholder ?? "Street, city, province"}
                          className="mt-1 text-white placeholder:text-white/60"
                          textareaRows={3}
                        />
                        {!hasGoogleAddressAutocomplete() ? (
                          <p className="text-xs text-neutral-400 mt-1">{t.terms.bookingAddressNoPlaces}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {hasGrowthServiceExtras(subscriptionTierNormalized) && (
                  <>
                    <div>
                      <Label>{t.dashboard.autoReplyLabel ?? "Automated reply"}</Label>
                      <p className="text-xs text-neutral-400 mt-0.5">{t.dashboard.autoReplyGrowthHint}</p>
                      <Textarea
                        placeholder={t.dashboard.autoReplyPlaceholder ?? ""}
                        value={serviceFormAutoReply}
                        onChange={(e) => setServiceFormAutoReply(e.target.value)}
                        rows={3}
                        className="mt-1 resize-none text-white placeholder:text-white/60"
                      />
                    </div>
                    <div>
                      <Label>{t.dashboard.renewalMonthsLabel ?? "Renewal (months)"}</Label>
                      <p className="text-xs text-neutral-400 mt-0.5">{t.dashboard.renewalGrowthHint}</p>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={t.dashboard.renewalMonthsPlaceholder ?? ""}
                        value={serviceFormRenewalMonths}
                        onChange={(e) => setServiceFormRenewalMonths(e.target.value.replace(/[^0-9]/g, ""))}
                        className={`mt-1 text-white placeholder:text-white/60 ${INPUT_NO_NUMBER_SPIN}`}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setServiceDialogOpen(false)} className="border-white text-white hover:bg-white/10 hover:text-white">
                  {t.common.cancel ?? "Cancel"}
                </Button>
                <Button
                  onClick={handleSaveService}
                  disabled={
                    savingService ||
                    (!serviceDialogEditing && (!proProfile?.primary_category_slug?.trim() || !serviceFormService))
                  }
                  className="gap-2"
                >
                  {savingService && <Loader2 size={14} className="animate-spin" />}
                  {t.common.save ?? "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.dashboard.bundleDialogTitle ?? "Create bundle"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t.dashboard.bundleNameLabel ?? "Bundle name"}</Label>
                  <Input value={bundleFormName} onChange={(e) => setBundleFormName(e.target.value)} className="mt-1" placeholder="" />
                </div>
                <div>
                  <Label>{t.dashboard.bundlePickServices ?? "Services"}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.dashboard.bundleNeedTwoServices}</p>
                  <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                    {proServices.map((s) => {
                      const key = `${s.category_slug}/${s.service_slug}`;
                      const catalogEn = catalogEnNameForProService(s.category_slug, s.service_slug, serviceCategories);
                      const name = labelProService(s, locale, catalogEn);
                      const checked = bundleFormKeys.includes(key);
                      return (
                        <li key={key}>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = v === true;
                                setBundleFormKeys((prev) => {
                                  if (on) return prev.includes(key) ? prev : [...prev, key];
                                  return prev.filter((k) => k !== key);
                                });
                              }}
                            />
                            <span>{name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" type="button" onClick={() => setBundleDialogOpen(false)}>
                  {t.common.cancel ?? "Cancel"}
                </Button>
                <Button type="button" onClick={() => void handleSaveBundle()} disabled={savingBundle} className="gap-2">
                  {savingBundle && <Loader2 size={14} className="animate-spin" />}
                  {t.dashboard.bundleSave ?? "Save"}
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

          <Dialog open={!!reviewClientBooking} onOpenChange={(open) => { if (!open) clearClientReviewForm(); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.dashboard.reviewClientTitle}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t.dashboard.reviewClientDesc}</p>
              <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                {t.reviews.definitiveNotice}
              </p>
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
              <ClientReviewPhotoPicker
                photos={clientReviewPhotos}
                previewUrls={clientReviewPhotoPreviews}
                onPhotosChange={(files, previews) => {
                  setClientReviewPhotos(files);
                  setClientReviewPhotoPreviews(previews);
                }}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={clearClientReviewForm}>{t.common.cancel}</Button>
                <Button onClick={handleSubmitClientReview} disabled={clientReviewSubmitting || clientReviewRating < 1} className="gap-2">
                  {clientReviewSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {t.reviews.submitReview}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!reviewProForClientId}
            onOpenChange={(open) => {
              if (!open) setReviewProForClientId(null);
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t.reviews.leaveReview}</DialogTitle>
              </DialogHeader>
              {reviewProForClientId ? (
                <ReviewForm
                  proProfileId={reviewProForClientId}
                  hideTitle
                  onSubmitted={() => {
                    const reviewedId = reviewProForClientId;
                    setReviewProForClientId(null);
                    if (reviewedId) {
                      setReviewedProIds((prev) => new Set(prev).add(reviewedId));
                    }
                    notifyReviewsChanged();
                  }}
                />
              ) : null}
            </DialogContent>
          </Dialog>

          <AlertDialog open={clientReviewConfirmOpen} onOpenChange={setClientReviewConfirmOpen}>
            <AlertDialogContent className={contrastDialogContentClass}>
              <AlertDialogHeader>
                <AlertDialogTitle className={contrastDialogTitleClass}>{t.reviews.confirmTitle}</AlertDialogTitle>
                <AlertDialogDescription className={contrastDialogDescriptionClass}>{t.reviews.confirmBody}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleSubmitClientReviewConfirmed()}>
                  {t.reviews.confirmSubmit}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
            bookingStatusCode={claimBooking?.statusCode ?? null}
          />

          <TabsContent value="account" className="space-y-4 flex flex-col items-center">
            <div className="flex justify-center w-full max-w-lg mx-auto pt-2">
              <ClickableProfileAvatar
                className="h-24 w-24"
                src={profile?.avatar_url}
                fallback={(profile?.full_name ?? accountForm.full_name ?? user?.email ?? "?").slice(0, 2).toUpperCase()}
                alt={profile?.full_name ?? ""}
                onSave={saveProfileAvatar}
              />
            </div>
            <form onSubmit={saveAccount} className="rounded-xl border bg-card p-6 md:p-8 space-y-4 max-w-lg w-full mx-auto" data-tour="account-profile">
              <div className="space-y-2">
                <Label htmlFor="acc-name">{t.dashboard.accountName}</Label>
                <Input id="acc-name" value={accountForm.full_name} onChange={(e) => setAccountForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="e.g. Ryan Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-phone">{t.dashboard.accountPhone}</Label>
                <Input
                  id="acc-phone"
                  type="tel"
                  inputMode="tel"
                  value={accountForm.phone}
                  onChange={(e) => setAccountForm((p) => ({ ...p, phone: formatCanadianPhone(e.target.value) }))}
                  placeholder="(450) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-postal">{t.dashboard.accountPostalCode}</Label>
                <Input
                  id="acc-postal"
                  value={accountForm.postal_code}
                  onChange={(e) => setAccountForm((p) => ({ ...p, postal_code: formatCanadianPostal(e.target.value) }))}
                  placeholder={CANADIAN_POSTAL_PLACEHOLDER}
                  maxLength={7}
                  className="font-mono uppercase tracking-wide"
                />
                <p className="text-xs text-muted-foreground">{t.dashboard.accountPostalHint}</p>
              </div>
              {proProfile ? (
                <div className="space-y-2">
                  <Label>{t.createPro?.businessAddressInvoiceLabel ?? "Business address for invoices"}</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2">
                    {proProfile.business_address?.trim() || accountForm.address.trim() || (
                      <span className="italic">{t.dashboard.accountBusinessAddressNotSet}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.dashboard.accountBusinessAddressSyncedHint}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setProProfileEditorOpen(true)}>
                    {t.joinPros?.editProfile ?? "Edit Pro Profile"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="acc-address">{t.dashboard.accountAddress}</Label>
                  <AddressInput
                    id="acc-address"
                    value={accountForm.address}
                    onChange={(v) => setAccountForm((p) => ({ ...p, address: v }))}
                    placeholder={t.dashboard.accountAddressPlaceholder}
                    className="w-full"
                    textareaRows={4}
                  />
                  {!hasGoogleAddressAutocomplete() ? (
                    <p className="text-xs text-muted-foreground">{t.terms.bookingAddressNoPlaces}</p>
                  ) : null}
                </div>
              )}
              <div className="space-y-2">
                <Label>{t.dashboard.accountEmail}</Label>
                <Input value={user.email ?? ""} readOnly className="bg-muted" />
                <p className="text-xs text-muted-foreground">{t.dashboard.accountEmailHint}</p>
              </div>
              <div className="space-y-2">
                <Label>{t.auth.emailLanguageLabel}</Label>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.auth.emailLanguageLabel}>
                  <button
                    type="button"
                    aria-pressed={accountForm.email_language === "en"}
                    onClick={() => setAccountForm((p) => ({ ...p, email_language: "en" }))}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      accountForm.email_language === "en"
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    aria-pressed={accountForm.email_language === "fr"}
                    onClick={() => setAccountForm((p) => ({ ...p, email_language: "fr" }))}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      accountForm.email_language === "fr"
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    Français
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t.dashboard.accountEmailLanguageHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-birthday">{t.dashboard.accountBirthday}</Label>
                <Input
                  id="acc-birthday"
                  type="date"
                  value={accountForm.birthday}
                  onChange={(e) => setAccountForm((p) => ({ ...p, birthday: e.target.value }))}
                  disabled={hasSavedBirthday}
                  max={maxBirthdayForMinAge()}
                  className={hasSavedBirthday ? "bg-muted" : undefined}
                />
              {(profile as { public_user_number?: string | null } | null)?.public_user_number ? (
                <p className="text-xs text-muted-foreground font-mono">
                  {t.dashboard.accountMemberId ?? "Member ID"}: {(profile as { public_user_number: string }).public_user_number}
                </p>
              ) : null}
              </div>
              {proProfile && !isAdminDashboardShell && (
                <div className="space-y-2">
                  <Label htmlFor="acc-main-category">{t.dashboard.mainServiceCategory ?? "Main service category"}</Label>
                  <select
                    id="acc-main-category"
                    value={accountMainCategory}
                    onChange={(e) => setAccountMainCategory(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{t.dashboard.selectMainCategory ?? "Select a category"}</option>
                    {serviceCategories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {getCategoryName(c, locale)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {t.dashboard.mainCategoryHint ?? "The services you list are for this one category. You can change it anytime."}
                  </p>
                </div>
              )}
              <Button type="submit" disabled={accountSaving} className="gap-2">
                {accountSaving && <Loader2 size={16} className="animate-spin" />}
                {t.dashboard.saveAccount}
              </Button>
            </form>
            <div className="rounded-xl border border-destructive/30 bg-card p-6 md:p-8 max-w-lg w-full mx-auto space-y-3">
              <h3 className="font-heading font-semibold text-foreground">
                {locale === "fr" ? "Demande de suppression de compte" : "Account deletion request"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {locale === "fr"
                  ? "Soumettez une demande. Certains dossiers (facturation, audit, sécurité) peuvent être conservés lorsque requis. LEGAL_REVIEW_REQUIRED pour les délais de rétention."
                  : "Submit a request. Some records (billing, audit, security) may be retained where required. LEGAL_REVIEW_REQUIRED for retention periods."}
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive"
                onClick={() => {
                  void (async () => {
                    if (!user?.id) return;
                    const { error } = await supabase.from("account_deletion_requests" as "profiles").insert({
                      user_id: user.id,
                      status: "pending",
                      reason: "user_dashboard_request",
                      retain_financial: true,
                      retain_audit: true,
                    } as never);
                    if (error) {
                      toast({
                        title: t.auth.toastError,
                        description: error.message,
                        variant: "destructive",
                      });
                      return;
                    }
                    toast({
                      title: locale === "fr" ? "Demande envoyée" : "Request submitted",
                      description:
                        locale === "fr"
                          ? "Nous traiterons votre demande. Vous pouvez aussi écrire à support@premiereservices.ca."
                          : "We will process your request. You can also email support@premiereservices.ca.",
                    });
                  })();
                }}
              >
                {locale === "fr" ? "Demander la suppression" : "Request deletion"}
              </Button>
            </div>
            {proProfile ? (
              <div className="rounded-xl border bg-card p-6 md:p-8 max-w-lg w-full mx-auto space-y-4" data-tour="account-cancel-policy">
                <h3 className="font-heading font-semibold text-foreground">
                  {locale === "fr" ? "Politique d’annulation (clients)" : "Cancellation policy (clients)"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {locale === "fr"
                    ? "Par défaut pour vos réservations. Vous pouvez aussi fixer des frais par service dans Mes services (Ajouter / Modifier un service)."
                    : "Default for your bookings. You can also set a fee per service in My Services (Add / Edit service)."}
                </p>
                <div className="space-y-2">
                  <Label>{locale === "fr" ? "Option" : "Option"}</Label>
                  <select
                    value={bookingCancelPolicy}
                    onChange={(e) => setBookingCancelPolicy(e.target.value as "free" | "late_fee" | "no_cancel")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="free">
                      {locale === "fr" ? "1 — Annulation gratuite" : "1 — Free cancellation"}
                    </option>
                    <option value="late_fee">
                      {locale === "fr"
                        ? "2 — Frais si annulation moins de 24 h avant"
                        : "2 — Fee if cancelled less than 24 hours before"}
                    </option>
                    <option value="no_cancel">
                      {locale === "fr"
                        ? "3 — Aucune annulation (frais complets)"
                        : "3 — No cancellation (full charge)"}
                    </option>
                  </select>
                </div>
                {bookingCancelPolicy === "late_fee" ? (
                  <div className="space-y-2">
                    <Label>{locale === "fr" ? "Pourcentage de frais (< 24 h)" : "Fee percent (< 24h)"}</Label>
                    <select
                      value={bookingCancelFeePercent}
                      onChange={(e) => setBookingCancelFeePercent(Number(e.target.value) as 25 | 50 | 75)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value={25}>25%</option>
                      <option value={50}>50%</option>
                      <option value={75}>75%</option>
                    </select>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 p-3">
                  {locale === "fr"
                    ? bookingCancelPolicy === "free"
                      ? "Aperçu client : annulation gratuite."
                      : bookingCancelPolicy === "no_cancel"
                        ? "Aperçu client : une fois confirmée, la réservation ne peut pas être annulée sans être facturée à 100 %."
                        : `Aperçu client : annulation à moins de 24 h = frais de ${bookingCancelFeePercent} % du prix du service.`
                    : bookingCancelPolicy === "free"
                      ? "Client preview: free cancellation."
                      : bookingCancelPolicy === "no_cancel"
                        ? "Client preview: once confirmed, the booking cannot be cancelled without a full (100%) charge."
                        : `Client preview: cancel less than 24h before = ${bookingCancelFeePercent}% of the service price.`}
                </p>
                <Button
                  type="button"
                  disabled={bookingCancelPolicySaving || !proProfile.id}
                  className="gap-2"
                  onClick={() => {
                    void (async () => {
                      setBookingCancelPolicySaving(true);
                      try {
                        const { error } = await supabase
                          .from("pro_profiles")
                          .update({
                            booking_cancel_policy: bookingCancelPolicy,
                            booking_cancel_fee_percent: bookingCancelFeePercent,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", proProfile.id);
                        if (error) throw error;
                        toast({
                          title: locale === "fr" ? "Enregistré" : "Saved",
                          description:
                            locale === "fr"
                              ? "Votre politique d’annulation est visible aux clients à la réservation."
                              : "Your cancellation policy will show to clients when they book.",
                        });
                      } catch (err) {
                        toast({
                          title: t.auth.toastError,
                          description: errorMessage(err),
                          variant: "destructive",
                        });
                      } finally {
                        setBookingCancelPolicySaving(false);
                      }
                    })();
                  }}
                >
                  {bookingCancelPolicySaving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {locale === "fr" ? "Enregistrer la politique" : "Save policy"}
                </Button>
              </div>
            ) : null}
            <div className="rounded-xl border bg-card p-6 md:p-8 max-w-lg w-full mx-auto space-y-4" data-tour="account-id-verification">
              <button
                type="button"
                onClick={() => setBookingIdVerificationOpen((open) => !open)}
                className="flex w-full items-center gap-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={bookingIdVerificationOpen}
                aria-controls="account-booking-id-verification"
              >
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/40">
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                </span>
                <h3 className="font-heading font-semibold text-foreground">
                  {t.dashboard.accountBookingIdVerificationTitle}
                </h3>
              </button>
              {bookingIdVerificationOpen ? (
                <div id="account-booking-id-verification" className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t.dashboard.accountBookingIdVerificationFrontOnly}</p>
                  {profile?.booking_id_verification_photo_path?.trim() ? (
                    <>
                      {bookingIdVerificationPreviewUrl ? (
                        (profile.booking_id_verification_photo_path ?? "").toLowerCase().endsWith(".pdf") ? (
                          <a
                            href={bookingIdVerificationPreviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex text-sm font-medium text-primary underline"
                          >
                            {t.dashboard.accountBookingIdVerificationViewPdf}
                          </a>
                        ) : (
                          <img
                            src={bookingIdVerificationPreviewUrl}
                            alt=""
                            className="rounded-lg border border-border max-h-64 w-full object-contain bg-muted/30"
                            onError={() => setBookingIdVerificationPreviewUrl(null)}
                          />
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">{t.dashboard.accountIdPreviewUnavailable}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{t.terms.bookingPhotoWithIdReplaceLabel}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t.terms.bookingPhotoWithIdHint}</p>
                  )}
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (!file) {
                        setAccountIdVerificationFile(null);
                        return;
                      }
                      try {
                        assertClientBookingIdFile(file);
                        setAccountIdVerificationFile(file);
                      } catch (err) {
                        setAccountIdVerificationFile(null);
                        const code = (err as Error).message;
                        toast({
                          title: t.auth.toastError,
                          description:
                            code === "ID_FILE_TOO_LARGE"
                              ? locale === "fr"
                                ? "Fichier trop volumineux (max. 8 Mo)."
                                : "File too large (max 8 MB)."
                              : locale === "fr"
                                ? "Utilisez une image ou un PDF."
                                : "Please use an image or PDF.",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <Button
                    type="button"
                    disabled={!accountIdVerificationFile || accountIdVerificationSaving || !user?.id}
                    className="gap-2"
                    onClick={() => {
                      if (!user?.id || !accountIdVerificationFile) return;
                      void (async () => {
                        setAccountIdVerificationSaving(true);
                        try {
                          const path = await persistClientBookingIdVerificationOnProfile(
                            user.id,
                            accountIdVerificationFile,
                            profile?.booking_id_verification_photo_path,
                          );
                          setProfile((p) =>
                            p
                              ? {
                                  ...p,
                                  booking_id_verification_photo_path: path,
                                  booking_id_verification_status: "verified",
                                }
                              : p,
                          );
                          setAccountIdVerificationFile(null);
                          toast({
                            title: t.dashboard.accountBookingIdVerificationSavedTitle,
                            description: t.dashboard.accountBookingIdVerificationSaved,
                          });
                        } catch (err) {
                          const msg = errorMessage(err);
                          toast({
                            title: t.auth.toastError,
                            description: msg.includes("MISSING_PROFILE_COLUMN")
                              ? locale === "fr"
                                ? "Colonne manquante en base de données. Exécutez la migration client_booking_id_verification dans Supabase."
                                : "Database column missing. Run migration 20260516120000_client_booking_id_verification.sql in Supabase."
                              : msg.includes("ID_FILE_TOO_LARGE")
                                ? locale === "fr"
                                  ? "Fichier trop volumineux (max. 8 Mo)."
                                  : "File too large (max 8 MB)."
                                : msg,
                            variant: "destructive",
                          });
                        } finally {
                          setAccountIdVerificationSaving(false);
                        }
                      })();
                    }}
                  >
                    {accountIdVerificationSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                    {profile?.booking_id_verification_photo_path?.trim()
                      ? t.dashboard.accountBookingIdVerificationUpdate
                      : t.dashboard.accountBookingIdVerificationSave}
                  </Button>
                </div>
              ) : null}
            </div>
            {proProfile?.is_verified && isPaidSubscriptionPlanId(proSubscriptionPlanId) && (
              <div className={`max-w-lg w-full mx-auto rounded-xl p-[2px] ${PLAN_TIER_BORDER_CLASS[currentPlanTheme]}`}>
                <div className="rounded-[calc(0.75rem-2px)] border border-border/70 bg-card p-6 md:p-8">
                <h3 className="font-heading font-bold mb-3 max-w-full min-w-0 text-balance break-words leading-snug current-plan-rainbow-heading">
                  {t.dashboard.myCurrentPlan}
                </h3>
                <p className={`text-lg mb-4 ${PLAN_TIER_NAME_CLASS[currentPlanTheme]}`}>
                  {subscriptionTierNormalized === "starter"
                    ? (t.plans?.starter ?? "Starter")
                    : subscriptionTierNormalized === "growth"
                      ? (t.plans?.growth ?? "Growth")
                      : (t.plans?.pro ?? "Pro")}
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  {(subscriptionTierNormalized === "starter"
                    ? (t.plans?.starterFeatures ?? [])
                    : subscriptionTierNormalized === "growth"
                      ? (t.plans?.growthFeatures ?? [])
                      : [...(t.plans?.growthFeatures ?? []), ...(t.plans?.proAddOnFeatures ?? [])]
                  ).map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle size={16} className={`shrink-0 ${PLAN_TIER_CHECK_CLASS[currentPlanTheme]}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.plans?.bestFor ?? "Best for:"}{" "}
                  {subscriptionTierNormalized === "starter"
                    ? (t.plans?.bestForStarter ?? "")
                    : subscriptionTierNormalized === "growth"
                      ? (t.plans?.bestForGrowth ?? "")
                      : (t.plans?.bestForPro ?? "")}
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  {subscriptionTierNormalized === "starter"
                    ? (t.dashboard.subscriptionInfoStarter ??
                      "You?re on the Starter plan today. When you upgrade to Growth or Pro, your subscription will renew monthly from your upgrade date.")
                    : (t.dashboard.subscriptionInfoPaid ??
                      "Your subscription renews monthly from your billing date. You can change plans anytime.")}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/pro-plans">{t.dashboard.upgradeDowngradeLink}</Link>
                </Button>
                </div>
              </div>
            )}
            {proProfile?.is_verified && !isPaidSubscriptionPlanId(proSubscriptionPlanId) && (
              <div className="max-w-lg w-full mx-auto rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-6 md:p-8">
                <h3 className="font-heading font-bold mb-2 text-foreground">{t.dashboard.proTabNoPaidPlanTitle}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t.dashboard.proTabNoPaidPlanBody}</p>
                <Button variant="default" size="sm" asChild>
                  <Link to="/pro-plans">{t.dashboard.upgradeDowngradeLink}</Link>
                </Button>
              </div>
            )}
            {proProfile ? (
              <div className="flex justify-center w-full">
                <DashboardTourHelpButton onClick={() => replayDashTour("account")} />
              </div>
            ) : null}
          </TabsContent>

          {!isAdminDashboardShell ? (
          <>
          <TabsContent value="bookings" className="space-y-4">
            {proProfile?.is_verified && proViewingMyRequests ? (
              <div className="rounded-xl border bg-card p-4 sm:p-6 md:p-8" data-tour="booking-requests">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-heading font-bold text-foreground">
                    {t.dashboard.myRequestsTitle ?? (locale === "fr" ? "Mes demandes" : "My requests")}
                  </h3>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link to="/dashboard?tab=bookings">{t.dashboard.schedule ?? "Schedule"}</Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{t.dashboard.acceptDenyHint ?? "Accept or deny each request below."}</p>
                {proBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.dashboard.emptyBookings}</p>
                ) : (
                  <ul className="space-y-3">{proBookings.map(renderProBookingRequestCard)}</ul>
                )}
                <div className="flex justify-center">
                  <DashboardTourHelpButton onClick={() => replayDashTour("bookings")} />
                </div>
              </div>
            ) : proProfile?.is_verified && !proViewingMyRequests ? (
              <div className="rounded-xl border bg-card p-4 sm:p-6 md:p-8">
                <h3 className="font-heading font-bold text-foreground mb-1 flex items-start gap-2 text-base leading-snug sm:items-center sm:text-lg">
                  <Clock size={18} className="mt-0.5 shrink-0 sm:mt-0" />
                  <span className="min-w-0">
                    <span className="hidden sm:inline">
                      {t.dashboard.schedule ?? "Schedule"} &amp; {t.dashboard.currentBookings}
                    </span>
                    <span className="sm:hidden">
                      {t.dashboard.schedule ?? "Schedule"} &amp; {locale === "fr" ? "Réservations" : "Bookings"}
                    </span>
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  <span className="hidden sm:inline">{t.dashboard.scheduleBookingHint ?? "Manage your availability and see bookings on the calendar. Accept or deny requests below."}</span>
                  <span className="sm:hidden">{locale === "fr" ? "Gérez vos disponibilités et réservations." : "Manage availability and bookings."}</span>
                </p>
                <p className="lg:hidden text-sm mb-4">
                  <a href="#dashboard-open-leads" className="font-medium text-primary underline underline-offset-2">
                    {t.dashboard.availableJobsPanelTitle}
                  </a>
                  <span className="text-muted-foreground"> · {t.dashboard.availableJobsViewOnMobile}</span>
                </p>
                {(subscriptionTierNormalized === "starter" || subscriptionTierNormalized == null) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-50 p-3 text-sm mb-4">
                    {subscriptionTierNormalized == null
                      ? (t.dashboard.proTabNoPaidPlanBody ?? "")
                      : (t.dashboard.tierStarterScheduleCallout ?? "")}{" "}
                    <Link to="/pro-plans" className="font-semibold underline underline-offset-2">
                      {t.dashboard.upgradeDowngradeLink}
                    </Link>
                  </div>
                )}
                <div data-tour="schedule-calendar">
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
                  bookingEvents={proBookings.map((b) => {
                    const isLocked = lockedProBookingIds.has(b.id);
                    const start = b.preferred_time ? String(b.preferred_time) : null;
                    const timeLabel =
                      start
                        ? formatBookingTimeRange(start, b.service_duration_minutes) || start.slice(0, 5)
                        : b.created_at.slice(11, 16);
                    return {
                      dateStr: b.preferred_date ? String(b.preferred_date) : b.created_at.slice(0, 10),
                      label: isLocked ? (t.dashboard.requestLockedBadge ?? "Upgrade to unlock") : (clientProfiles[b.client_id]?.full_name ?? "Client"),
                      time: timeLabel,
                      status: b.status,
                      durationMinutes: b.service_duration_minutes ?? 60,
                      address: null,
                      email: null,
                      phone: proMaySeeClientPhone(b) ? (clientProfiles[b.client_id]?.phone ?? null) : null,
                    };
                  })}
                  scheduleWindowEndDateStr={
                    hasFullScheduleCalendarAccess(subscriptionTierNormalized) ? undefined : scheduleRollingWindowEndDateStr(30)
                  }
                  onNavigateBeyondScheduleWindow={() =>
                    toast({
                      title: (
                        <span className="bg-gradient-to-r from-purple-500 via-purple-600 to-orange-500 bg-clip-text text-transparent font-semibold">
                          {t.dashboard.scheduleWantToUpgrade ?? "Want to upgrade?"}
                        </span>
                      ),
                      description: t.dashboard.managePlanToast ?? "Manage your plan ? Upgrade or downgrade anytime.",
                      onClick: () => navigate("/pro-plans"),
                    })
                  }
                  onSaveBlockedHours={handleSaveBlockedHours}
                  savingBlockedHours={savingBlockedHours}
                />
                <Button type="button" onClick={handleSaveSchedule} disabled={savingSchedule} className="mt-4 gap-2">
                  {savingSchedule && <Loader2 size={16} className="animate-spin" />}
                  {t.common.save ?? "Save"} {t.dashboard.schedule}
                </Button>
                </div>
                <div data-tour="booking-requests" className="mt-8">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-heading font-semibold text-foreground">{t.dashboard.bookingRequests ?? "Booking requests"}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <Link to="/dashboard?tab=bookings&view=my-requests">{locale === "fr" ? "Mes demandes" : "My requests"}</Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{t.dashboard.acceptDenyHint ?? "Accept or deny each request below."}</p>
                {proBookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.dashboard.emptyBookings}</p>
                ) : (
                  <ul className="space-y-3">
                    {proBookings.map((b) => renderProBookingRequestCard(b))}
                  </ul>
                )}
                </div>

                <div id="received-quotes" className="mt-10 rounded-xl border border-border bg-muted/20 p-5 sm:p-6 scroll-mt-24">
                  <h4 className="font-heading font-bold text-foreground mb-1">{t.dashboard.quotesReceivedSection}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{t.dashboard.quotesReceivedHint}</p>
                  {jobRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {locale === "fr" ? "Aucune demande pour l’instant." : "No requests yet."}
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {jobRequests.map((req) => {
                        const quotes = jobQuotesByRequestId[req.id] ?? [];
                        return (
                          <li key={req.id} className="rounded-lg border bg-card p-4">
                            <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden />
                              <span className="min-w-0">{req.description}</span>
                              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                {(t.dashboard.quotesReceivedCount ?? "{{count}} quote(s)").replace(
                                  "{{count}}",
                                  String(quotes.length)
                                )}
                              </span>
                            </div>
                            {quotes.length > 0 ? (
                              <ul className="mt-3 space-y-2">
                                {quotes.map((q) => (
                                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-3 text-sm">
                                    <div>
                                      <span className="font-medium">{q.business_name || "Pro"}</span>
                                      {q.price_cents != null && <span className="ml-2">${(q.price_cents / 100).toFixed(0)}</span>}
                                    </div>
                                    <span className="text-muted-foreground capitalize">{q.status}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">{t.dashboard.quotesReceivedEmpty}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {proProfile?.is_verified ? (
                  <div className="flex justify-center">
                    <DashboardTourHelpButton onClick={() => replayDashTour("bookings")} />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-8">
                {proProfile && !proProfile.is_verified ? (
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                    {t.dashboard.pendingProBookingsWhilePending}
                  </div>
                ) : null}
                {/* Client: Service requests (Make a Request) and quotes */}
                <div id="received-quotes" className="rounded-xl border bg-card p-6 md:p-8 scroll-mt-24">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div>
                        <h3 className="font-heading font-bold text-foreground mb-1">
                          {t.dashboard.quotesReceivedSection}
                        </h3>
                        <p className="text-sm text-muted-foreground">{t.dashboard.quotesReceivedHint}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {proProfile?.is_verified ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/dashboard?tab=bookings">{t.dashboard.currentBookings}</Link>
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="outline">
                          <Link to="/make-request">{t.makeRequest.draftsTitle}</Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link to="/make-request">{locale === "fr" ? "Faire une demande" : "Make a request"}</Link>
                        </Button>
                      </div>
                    </div>
                    <ul className="space-y-6">
                      {jobRequests.map((req) => {
                        const quotes = jobQuotesByRequestId[req.id] ?? [];
                        return (
                          <li key={req.id} className="py-4 border-b border-border/50 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-medium text-foreground inline-flex flex-wrap items-center gap-2">
                                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden />
                                  <span>{req.description}</span>
                                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                                    {(t.dashboard.quotesReceivedCount ?? "{{count}} quote(s)").replace(
                                      "{{count}}",
                                      String(quotes.length)
                                    )}
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {req.category} · {req.city && req.province ? `${req.city}, ${req.province}` : "—"} ·{" "}
                                  {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                                </div>
                              </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => {
                                  setEditJobRequestId(req.id);
                                  setEditReqDescription(req.description ?? "");
                                  setEditReqCategory(req.category ?? "");
                                  setEditReqTiming(req.timing ?? "");
                                  const budget = req.budget_range ?? "";
                                  const parts = budget.includes("-") ? budget.split("-").map((x) => x.trim()) : [budget.trim()];
                                  setEditReqBudgetMin(parts[0] ?? "");
                                  setEditReqBudgetMax(parts.length > 1 ? (parts[1] ?? "") : "");
                                  const sched = hydrateSchedulingFormFromRow(req);
                                  setEditReqAvailabilityMode(sched.availabilityMode);
                                  setEditReqPreferredDate(sched.preferredDate);
                                  setEditReqTimeWindow(sched.preferredTimeWindow);
                                  setEditReqRangeStartDate(sched.rangeStartDate);
                                  setEditReqRangeEndDate(sched.rangeEndDate);
                                  setEditReqStartHour(sched.startHour);
                                  setEditReqEndHour(sched.endHour);
                                  setEditReqExactTime(sched.exactTime);
                                }}
                              >
                                <Pencil size={14} /> Edit
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1 text-destructive hover:text-destructive"
                                disabled={deletingJobRequestId === req.id}
                                onClick={() => void deleteClientJobRequest(req.id)}
                              >
                                {deletingJobRequestId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{" "}
                                {t.dashboard.deleteRequest ?? "Delete"}
                              </Button>
                            </div>
                            </div>
                            {quotes.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-semibold text-foreground mb-2">{t.dashboard.quotesReceivedTitle}</p>
                                <ul className="space-y-2">
                                  {quotes.map((q) => {
                                    const serviceDateRaw =
                                      (typeof q.proposed_service_date === "string" && q.proposed_service_date.trim()
                                        ? q.proposed_service_date.trim().slice(0, 10)
                                        : null) ||
                                      (typeof req.preferred_date === "string" && req.preferred_date.trim()
                                        ? req.preferred_date.trim().slice(0, 10)
                                        : null);
                                    const serviceDateLabel = serviceDateRaw
                                      ? new Date(`${serviceDateRaw}T12:00:00`).toLocaleDateString(
                                          locale === "fr" ? "fr-CA" : "en-CA",
                                          { dateStyle: "medium" },
                                        )
                                      : null;
                                    return (
                                    <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/40">
                                      <div>
                                        <span className="font-medium">{q.business_name || "Pro"}</span>
                                        {q.price_cents != null && <span className="ml-2">${(q.price_cents / 100).toFixed(0)}</span>}
                                        {serviceDateLabel ? (
                                          <span className="text-muted-foreground text-sm ml-2">· {serviceDateLabel}</span>
                                        ) : null}
                                        {q.estimated_time && <span className="text-muted-foreground text-sm ml-2">· {q.estimated_time}</span>}
                                        {q.message && <p className="text-sm text-muted-foreground mt-1">{q.message}</p>}
                                      </div>
                                      {q.status === "pending" && (
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={() => {
                                            if (!q.price_cents || q.price_cents <= 0) {
                                              toast({
                                                title: t.dashboard.quotePaymentRequiredTitle ?? "Payment required",
                                                description: t.dashboard.quoteAcceptNeedsPrice ?? "This quote cannot be accepted until a payable amount is provided.",
                                                variant: "destructive",
                                              });
                                              return;
                                            }
                                            setQuotePaymentError(null);
                                            setQuotePaymentTarget({ requestId: req.id, quote: q });
                                          }} disabled={!!acceptQuoteId}>
                                            {acceptQuoteId === q.id ? <Loader2 size={14} className="animate-spin" /> : null} {t.dashboard.quoteAccept ?? "Accept"}
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={async () => {
                                            setDeclineQuoteId(q.id);
                                            const { error } = await supabase.from("job_quotes").update({ status: "declined", updated_at: new Date().toISOString() }).eq("id", q.id);
                                            if (error) toast({ title: t.auth.toastError ?? "Error", description: error.message, variant: "destructive" });
                                            else toast({ title: t.dashboard.quoteDeclinedTitle ?? "Quote declined" });
                                            setJobQuotesByRequestId((prev) => ({
                                              ...prev,
                                              [req.id]: (prev[req.id] ?? []).map((x) => x.id === q.id ? { ...x, status: "declined" } : x),
                                            }));
                                            setDeclineQuoteId(null);
                                          }} disabled={!!declineQuoteId}>
                                            {declineQuoteId === q.id ? <Loader2 size={14} className="animate-spin" /> : null} {t.dashboard.quoteDecline ?? "Decline"}
                                          </Button>
                                        </div>
                                      )}
                                      {q.status === "accepted" && <span className="text-sm text-green-600 dark:text-green-400">{t.dashboard.quoteAcceptedStatus ?? "Accepted"}</span>}
                                      {q.status === "declined" && <span className="text-sm text-muted-foreground">{t.dashboard.quoteDeclinedStatus ?? "Declined"}</span>}
                                    </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {quotes.length === 0 && (
                              <p className="text-sm text-muted-foreground mt-2">{t.dashboard.quotesReceivedEmpty}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {jobRequests.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {locale === "fr" ? "Aucune demande pour l’instant." : "No requests yet."}
                      </p>
                    )}
                  </div>
                {/* My bookings (existing pro bookings) */}
                {clientBookings.length > 0 ? (
                  <div className="rounded-xl border bg-card p-6 md:p-8">
                    <h3 className="font-heading font-bold text-foreground mb-4">{t.dashboard.myBookings ?? "My bookings"}</h3>
                    <ul className="space-y-3">
                      {clientBookings.map((b) => {
                        const statusLabel =
                          b.status === "pending"
                            ? t.dashboard.bookingStatusPending
                            : b.status === "accepted"
                              ? t.dashboard.bookingStatusAccepted
                              : b.status === "completed"
                                ? t.dashboard.bookingStatusCompleted
                                : b.status === "declined"
                                  ? t.dashboard.bookingStatusDeclined
                                  : b.status === "cancelled"
                                    ? t.dashboard.bookingStatusCancelled
                                    : b.status;
                        const responseFmt = formatProResponseDuration(b.created_at, b.responded_at, locale);
                        const responseClientLine = responseFmt
                          ? (t.dashboard.clientProResponseLine ?? "").replace("{{value}}", responseFmt)
                          : t.dashboard.clientProResponsePending ?? "";
                        const rebookTo =
                          b.service_category_slug && b.service_slug
                            ? `/pros/${b.pro_profile_id}?service=${encodeURIComponent(b.service_category_slug)}/${encodeURIComponent(b.service_slug)}`
                            : `/pros/${b.pro_profile_id}`;
                        const showUnread = b.client_unread === true;
                        return (
                          <li key={b.id} className="py-4 border-b border-border/50 last:border-0 text-sm space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-foreground">{b.business_name || t.common.proFallback}</span>
                                  {showUnread && (
                                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                                      {t.dashboard.newBookingNotification ?? "New"}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(b.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })} �{" "}
                                  <span className="font-medium text-foreground/90">{statusLabel}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">{responseClientLine}</p>
                                {b.auto_reply_snapshot?.trim() && (
                                  <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs text-foreground/90 mt-1">
                                    <span className="font-semibold block mb-0.5">{t.dashboard.autoReplyFromPro}</span>
                                    {b.auto_reply_snapshot.trim()}
                                  </div>
                                )}
                                {b.client_renews_annually && b.renewal_interval_months_snapshot && b.renewal_anchor_date && (
                                  <p className="text-xs text-muted-foreground">
                                    {(t.dashboard.renewalClientLine ?? "")
                                      .replace("{{months}}", String(b.renewal_interval_months_snapshot))
                                      .replace(
                                        "{{date}}",
                                        new Date(String(b.renewal_anchor_date) + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })
                                      )}
                                  </p>
                                )}
                                {b.pro_service_at_workspace_only === true &&
                                (b.status === "accepted" || b.status === "completed") &&
                                (b.pro_business_address?.trim() ?? "") ? (
                                  <div className="mt-2 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground leading-relaxed">
                                    <span className="font-semibold block mb-1">{t.dashboard.workspaceVisitAddressLabel ?? "Visit address"}</span>
                                    {b.pro_business_address}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2 shrink-0">
                                {b.status === "accepted" && !bookingPaymentsById[b.id]?.square_payment_id ? (
                                  <Button type="button" size="sm" onClick={() => void openClientBookingPay(b)}>
                                    {t.terms.bookingPayNowButton ?? "Pay now"}
                                  </Button>
                                ) : null}
                                <Button asChild variant="outline" size="sm">
                                  <Link to={`/pros/${b.pro_profile_id}`}>{t.dashboard.viewPro ?? "View pro"}</Link>
                                </Button>
                                {["pending", "accepted", "completed", "cancelled"].includes(b.status) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setClaimBooking({ id: b.id, pro_profile_id: b.pro_profile_id, statusCode: b.status });
                                      setClaimDialogOpen(true);
                                    }}
                                  >
                                    {t.dashboard.invoiceReportIssue ?? "Report an issue"}
                                  </Button>
                                )}
                                {b.status === "completed" && (
                                  <>
                                    <Button asChild size="sm" variant="default">
                                      <Link to={rebookTo}>{t.dashboard.rebook}</Link>
                                    </Button>
                                    {!reviewedProIds.has(b.pro_profile_id) && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => void openReviewProDialog(b.pro_profile_id)}
                                      >
                                        {t.reviews.leaveReview}
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : jobRequests.length === 0 ? (
                  <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
                    <CalendarDays size={40} className="mx-auto mb-3 opacity-50" />
                    <p className="mb-4">{t.dashboard.emptyBookings}</p>
                    <Button asChild variant="outline">
                      <Link to="/services">{t.dashboard.browseServices}</Link>
                    </Button>
                  </div>
                ) : null}
                <div className="mt-5 flex justify-end">
                  <div className="rounded-md border bg-card/60 px-3 py-2 text-xs text-muted-foreground inline-flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden />
                      {t.dashboard.requestsCreatedByYouLegend ?? "Requests created by you"}
                    </span>
                    {proProfile?.is_verified ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden />
                        {t.dashboard.requestsReceivedFromClientsLegend ?? "Requests received from clients"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            {savedProsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
              </div>
            ) : savedPros.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
                <Heart size={40} className="mx-auto mb-3 opacity-50" />
                <p className="mb-4">{t.dashboard.emptyFavorites}</p>
                <Button asChild variant="outline">
                  <Link to="/services">{t.dashboard.findPros}</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Heart size={20} className="text-red-500" /> {t.dashboard.favorites}
                </h3>
                <ul className="space-y-3">
                  {savedPros.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarImage src={p.photoUrl ?? undefined} alt="" />
                        <AvatarFallback>{(p.business_name || "P").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link to={`/pros/${p.id}`} className="font-medium text-foreground hover:underline truncate block">
                            {p.business_name}
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            onClick={() => void handleUnsaveProFromDashboard(p.id)}
                            aria-label={t.dashboard.savedProRemove ?? "Remove from saved pros"}
                            title={t.dashboard.savedProRemove ?? "Remove from saved pros"}
                          >
                            <Heart size={17} className="fill-red-500" strokeWidth={0} />
                          </Button>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="shrink-0 text-muted-foreground" asChild>
                        <Link to={`/pros/${p.id}`}>{t.dashboard.viewPro ?? "View pro"}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4">
            <div data-tour="reviews-panel">
              <DashboardReviewsPanel
                proProfileId={showProReviewSection ? proProfile?.id ?? null : null}
                showProSection={showProReviewSection}
                onReviewClient={(bookingId, clientId) => void openReviewClientDialog(bookingId, clientId)}
                onReviewPro={(proId) => void openReviewProDialog(proId)}
              />
            </div>
            {proProfile ? (
              <div className="flex justify-center">
                <DashboardTourHelpButton onClick={() => replayDashTour("reviews")} />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            {(() => {
              void dashTourTick;
              const invoiceRows = clientBookings.filter((b) => b.status !== "declined");
              const uid = user?.id;
              const showMockInvoice =
                Boolean(uid && proProfile) && uid != null && !isSegmentCompleted(uid, "invoices");
              const mockSnapshot = showMockInvoice
                ? buildBookingInvoiceSnapshotV2({
                    proProfileId: "sample",
                    businessName: locale === "fr" ? "Exemple Pro Inc." : "Sample Pro Inc.",
                    supplierLegalName: locale === "fr" ? "Exemple Pro Inc." : "Sample Pro Inc.",
                    supplierAddress: "123 Rue Exemple, Montreal, QC H2X 1Y4",
                    serviceName: locale === "fr" ? "Service d'exemple" : "Sample service",
                    serviceDescriptionDetailed:
                      locale === "fr"
                        ? "Facture d'exemple — service, frais de plateforme et taxes."
                        : "Sample invoice — service, platform fee, and taxes.",
                    appointmentSummary: locale === "fr" ? "Exemple · 60 min" : "Sample · 60 min",
                    preferredDate: new Date().toISOString().slice(0, 10),
                    preferredTime: "10:00",
                    serviceDurationMinutes: 60,
                    customerAddress: locale === "fr" ? "Adresse client (exemple)" : "Client address (sample)",
                    baseAmountCents: 12000,
                    currency: "CAD",
                    paymentMethodLabel: "Card",
                  })
                : null;
              const statusLabel = (code: string) =>
                code === "pending"
                  ? t.dashboard.bookingStatusPending
                  : code === "accepted"
                    ? t.dashboard.bookingStatusAccepted
                    : code === "completed"
                      ? t.dashboard.bookingStatusCompleted
                      : code === "declined"
                        ? t.dashboard.bookingStatusDeclined
                        : code === "cancelled"
                          ? t.dashboard.bookingStatusCancelled
                          : code;
              return (
                <div className="space-y-4" data-tour="invoices-panel">
                  <p className="text-sm text-muted-foreground">{t.dashboard.invoicesIntro}</p>
                  {mockSnapshot ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {locale === "fr" ? "Exemple (tutoriel)" : "Sample (tutorial)"}
                      </p>
                      <BookingInvoiceCard
                        bookingId="tour-sample-invoice"
                        bookingPublicCode="SAMPLE"
                        bookingStatus={locale === "fr" ? "Exemple" : "Sample"}
                        businessName={mockSnapshot.business_name}
                        createdAt={new Date().toISOString()}
                        snapshotJson={mockSnapshot}
                        payment={{
                          amount_cents: mockSnapshot.total_cents,
                          currency: mockSnapshot.currency,
                          square_payment_id: null,
                          status: "COMPLETED",
                        }}
                        onReport={() => undefined}
                      />
                    </div>
                  ) : null}
                  {invoiceRows.length === 0 && !mockSnapshot ? (
                    <div className="rounded-xl border bg-card p-6 md:p-8 text-center text-muted-foreground">
                      <FileText size={40} className="mx-auto mb-3 opacity-50" />
                      <p className="mb-4">{t.dashboard.emptyInvoices}</p>
                      <Button asChild variant="outline">
                        <Link to="/services">{t.dashboard.browseServices}</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {invoiceRows.map((b) => (
                        <BookingInvoiceCard
                          key={b.id}
                          bookingId={b.id}
                          bookingPublicCode={b.public_booking_code ?? null}
                          bookingStatus={statusLabel(b.status)}
                          businessName={b.business_name || t.common.proFallback}
                          createdAt={b.created_at}
                          snapshotJson={b.invoice_snapshot}
                          payment={bookingPaymentsById[b.id] ?? null}
                          showSupplierAddress={b.pro_service_at_workspace_only === true}
                          onReport={() => {
                            setActiveTab("bookings");
                            setClaimBooking({ id: b.id, pro_profile_id: b.pro_profile_id, statusCode: b.status });
                            setClaimDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {proProfile ? (
                    <div className="flex justify-center">
                      <DashboardTourHelpButton onClick={() => replayDashTour("invoices")} />
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </TabsContent>
          </>
          ) : null}

          {isAdminDashboardShell && (
            <TabsContent value="admin" className="space-y-4">
              {!isAdmin ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-muted-foreground" size={32} />
                </div>
              ) : (
              <>
              <div className="rounded-xl border bg-card p-6 md:p-8">
                <h2 className="font-heading text-xl font-bold text-foreground mb-2 flex flex-wrap items-center gap-2">
                  <ShieldCheck size={24} className="shrink-0" />
                  <span className="min-w-0 flex-1">{t.dashboard.adminAcceptProsTitle ?? "Accept pros"}</span>
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {t.dashboard.adminAcceptProsIntro ?? "Approve applications so pros appear in search. Only you (admin) can see this."}
                </p>
                <Alert className="mb-6 border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-amber-950 dark:text-amber-50">
                    {t.dashboard.adminPaidPlanRequiredWarningTitle ?? "Paid plan or checkout required"}
                  </AlertTitle>
                  <AlertDescription className="text-amber-900/90 dark:text-amber-100/95">
                    {t.dashboard.adminPaidPlanRequiredWarning}
                  </AlertDescription>
                </Alert>
                {adminLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
                ) : pendingPros.length === 0 ? (
                  <p className="text-muted-foreground">{t.dashboard.adminNoPendingPros ?? "No pending pros right now."}</p>
                ) : (
                  <ul className="space-y-3">
                    {pendingPros.map((p) => {
                      const subPid = adminSubByUserId[p.user_id]?.plan_id;
                      const hasPaidEnrollment = !adminSubsLoading && isPaidSubscriptionPlanId(subPid);
                      const approveLocked = acceptingId !== null || adminSubsLoading || !hasPaidEnrollment;
                      return (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center gap-3 min-w-[240px]">
                          <span
                            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background"
                            title={
                              adminSubsLoading
                                ? ""
                                : hasPaidEnrollment
                                  ? (t.dashboard.adminPaidPlanBadgeOn ?? "")
                                  : (t.dashboard.adminPaidPlanBadgeOff ?? "")
                            }
                          >
                            {adminSubsLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                            ) : hasPaidEnrollment ? (
                              <BadgeCheck className="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                            )}
                          </span>
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={proPrimaryPhotoByProId[p.id]} alt={p.business_name} />
                            <AvatarFallback>{(p.business_name || "P").slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{p.business_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Applied {new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Member ID</span>{" "}
                            <span
                              className="font-mono truncate max-w-[200px] inline-block align-bottom"
                              title={`Internal: ${p.user_id}`}
                            >
                              {adminPublicUserNumberByUserId[p.user_id] ?? EM_DASH}
                            </span>
                          </p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setReviewProId(p.id)}>
                            {t.dashboard.reviewApplication ?? "Review application"}
                          </Button>
                          {(() => {
                            const subPlan = adminSubByUserId[p.user_id]?.plan_id;
                            const profileT = (p.subscription_tier ?? "").toLowerCase().trim();
                            const billingT = (subPlan ?? "").toLowerCase().trim();
                            const canSyncTier = !!subPlan && profileT !== billingT && !adminSubsLoading;
                            return canSyncTier ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleSyncTierFromSubscription(p.id, p.user_id)}
                                disabled={updatingTierId !== null}
                                title={t.dashboard.adminSyncTierFromBilling ?? ""}
                              >
                                {updatingTierId === p.id ? <Loader2 size={16} className="animate-spin" /> : null}{" "}
                                {t.dashboard.adminSyncTierFromBilling ?? "Sync tier from billing"}
                              </Button>
                            ) : null;
                          })()}
                          <Button
                            size="sm"
                            onClick={() => handleAcceptPro(p.user_id)}
                            disabled={approveLocked}
                            title={approveLocked && !adminSubsLoading && !hasPaidEnrollment ? (t.dashboard.adminApproveBlockedTooltip ?? "") : undefined}
                          >
                            {acceptingId === p.user_id ? <Loader2 size={16} className="animate-spin" /> : null} {t.dashboard.approve}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeclineProUserId(p.user_id)} disabled={!!declineProUserId}>
                            {t.dashboard.decline}
                          </Button>
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border bg-card p-6 md:p-8 mt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-heading text-lg font-bold text-foreground">
                    {t.dashboard.adminAllProsTitle ?? "All professionals"} ({allPros.length})
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadAllPros()} disabled={allProsLoading}>
                    {allProsLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t.dashboard.adminAllProsRefresh ?? "Refresh"}
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t.dashboard.adminAllProsBlurb ??
                    "Complete list - verified and pending. Admins can set tier from the dropdown."}
                </p>
                <div className="mb-4 max-w-xs">
                  <Label htmlFor="admin-member-filter">{t.dashboard.adminMemberIdSearch ?? "Look up by Member ID"}</Label>
                  <Input
                    id="admin-member-filter"
                    value={adminProMemberFilter}
                    onChange={(e) => setAdminProMemberFilter(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="font-mono mt-1"
                    inputMode="numeric"
                  />
                </div>
                {allProsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" size={28} /></div>
                ) : adminFilteredPros.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t.dashboard.adminNoProfessionalsYet ?? "No professionals yet."}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColBusiness ?? "Business"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColStatus ?? "Status"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColTier ?? "Tier"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColTrial ?? "Trial"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColFriendInvite ?? t.dashboard.referralInviteShort ?? "Friend invite"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColJoined ?? "Joined"}</th>
                          <th className="text-left py-2 font-medium text-muted-foreground font-mono text-xs">{t.dashboard.accountMemberId ?? "Member ID"}</th>
                          <th className="text-left py-2 font-medium text-foreground">{t.dashboard.adminColActions ?? "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminFilteredPros.map((p) => (
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
                            <td className="py-2">{p.is_verified ? <span className="text-green-600 dark:text-green-400">{t.dashboard.adminStatusVerified ?? "Verified"}</span> : <span className="text-amber-600 dark:text-amber-400">{t.dashboard.adminStatusPending ?? "Pending"}</span>}</td>
                            <td className="py-2">
                              {(() => {
                                const subPlan = adminSubByUserId[p.user_id]?.plan_id ?? null;
                                const displayTier = effectiveProTier(p.subscription_tier, subPlan ?? undefined);
                                const tierLabel =
                                  displayTier === null
                                    ? (t.dashboard.adminTierHold ?? "Hold")
                                    : displayTier === "starter"
                                      ? (t.plans?.starter ?? "Starter")
                                      : displayTier === "growth"
                                        ? (t.plans?.growth ?? "Growth")
                                        : (t.plans?.pro ?? "Pro");
                                const profileT = (p.subscription_tier ?? "").toLowerCase().trim();
                                const billingT = (subPlan ?? "").toLowerCase().trim();
                                const canSync = !!subPlan && profileT !== billingT && !adminSubsLoading;
                                return (
                                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                    {isAdmin ? (
                                      <select
                                        className="h-8 rounded-md border border-input bg-background px-2 text-sm capitalize"
                                        value={displayTier ?? "hold"}
                                        disabled={updatingTierId === p.id}
                                        onChange={(e) => void handleAdminSetTier(p.id, e.target.value)}
                                      >
                                        <option value="hold">{t.dashboard.adminTierHold ?? "Hold"}</option>
                                        <option value="starter">{t.plans?.starter ?? "Starter"}</option>
                                        <option value="growth">{t.plans?.growth ?? "Growth"}</option>
                                        <option value="pro">{t.plans?.pro ?? "Pro"}</option>
                                      </select>
                                    ) : (
                                      <span className="font-medium capitalize">{tierLabel}</span>
                                    )}
                                    {canSync ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 shrink-0 text-xs"
                                        onClick={() => void handleSyncTierFromSubscription(p.id, p.user_id)}
                                        disabled={updatingTierId !== null}
                                      >
                                        {updatingTierId === p.id ? <Loader2 size={14} className="animate-spin" /> : null}{" "}
                                        {t.dashboard.adminSyncTierFromBilling ?? "Sync from billing"}
                                      </Button>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2 text-muted-foreground whitespace-nowrap">
                              {adminSubByUserId[p.user_id]?.trial_ends_at
                                ? new Date(adminSubByUserId[p.user_id].trial_ends_at as string).toLocaleDateString(
                                    undefined,
                                    { dateStyle: "medium" }
                                  )
                                : EM_DASH}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={p.referral_invite_panel_enabled !== false}
                                  onCheckedChange={(v) => void handleAdminReferralInvitePanel(p.id, v === true)}
                                  disabled={updatingReferralPanelId !== null}
                                  aria-label={(t.dashboard.adminFriendInviteAria ?? "Friend invite panel for {{name}}").replace("{{name}}", p.business_name)}
                                />
                                {updatingReferralPanelId === p.id ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                                ) : null}
                              </div>
                            </td>
                            <td className="py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                            <td
                              className="py-2 font-mono text-xs text-muted-foreground truncate max-w-[180px]"
                              title={`Internal: ${p.user_id}`}
                            >
                              {adminPublicUserNumberByUserId[p.user_id] ?? EM_DASH}
                            </td>
                            <td className="py-2 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive gap-1" onClick={() => handleRemovePro(p.id)} disabled={removingProId !== null}>
                                {removingProId === p.id && <Loader2 size={14} className="animate-spin shrink-0" />}
                                {removingProId === p.id ? (t.dashboard.removing ?? "Removing?") : (t.dashboard.removeAsPro ?? "Remove as pro")}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <Link to="/admin/issue-reports">{t.dashboard.adminIssueReports}</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/admin/trial-tokens">{t.dashboard.adminTrialLinks}</Link>
                  </Button>
                </div>
              </div>
              </>
              )}
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

          <Dialog open={!!reviewProId} onOpenChange={(open) => { if (!open) setReviewProId(null); }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.dashboard.reviewApplication ?? "Review application"}</DialogTitle>
              </DialogHeader>
              {reviewProLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={32} /></div>
              ) : reviewProData ? (
                <div className="space-y-6 text-sm">
                  {parseApprovalBaselineJson((reviewProData.profile as { approval_baseline_json?: unknown }).approval_baseline_json) ? (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
                      <h4 className="font-semibold text-foreground">
                        {locale === "fr" ? "Modifications depuis la soumission" : "Changes since submission"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {locale === "fr"
                          ? "Comparez la version initiale et la version actuelle avant d'approuver."
                          : "Compare the original and current versions before approving."}
                      </p>
                      <ProProfileApprovalDiff
                        diffs={reviewProfileDiffs}
                        locale={locale}
                        lastEditedAt={reviewProfileLastEdited}
                      />
                    </div>
                  ) : null}
                  {((reviewProData.profile as Record<string, unknown>).personal_photo_url || (reviewProData.profile as Record<string, unknown>).id_document_url || reviewProData.photos?.length > 0) && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">{t.dashboard.photosAndId ?? "ID, selfie & photos"}</h4>
                      <div className="flex flex-wrap gap-6">
                        {(reviewProData.profile as Record<string, unknown>).id_document_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.idPicture ?? "ID document"}</p>
                            <AdminReviewPhoto
                              bucket="pro-photos"
                              url={(reviewProData.profile as Record<string, unknown>).id_document_url as string}
                              alt="ID"
                              className="rounded-lg border border-border max-h-64 w-48 object-contain bg-muted/30"
                            />
                          </div>
                        )}
                        {(reviewProData.profile as Record<string, unknown>).personal_photo_url && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.selfiePicture ?? "Selfie"}</p>
                            <AdminReviewPhoto
                              bucket="pro-photos"
                              url={(reviewProData.profile as Record<string, unknown>).personal_photo_url as string}
                              alt="Selfie"
                              className="rounded-lg border border-border max-h-64 w-48 object-cover"
                            />
                          </div>
                        )}
                        {reviewProData.photos?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{t.dashboard.beforeAfterPhotos ?? "Before/after photos"}</p>
                            <div className="flex flex-wrap gap-2">
                              {reviewProData.photos.map((ph, i) => (
                                <AdminReviewPhoto
                                  key={i}
                                  bucket="pro-photos"
                                  url={ph.url}
                                  alt={ph.caption || "Photo"}
                                  className="w-24 h-24 rounded-lg object-cover border border-border"
                                />
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
                            ? `$${reviewProData.profile.price_min} ? $${reviewProData.profile.price_max}`
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
                            <li key={i} className="text-foreground">
                              {catName} ? {serviceName}
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
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <h4 className="font-semibold text-foreground">{t.dashboard.adminPlanBillingSection ?? "Plan & payment record"}</h4>
                    <p className="text-xs text-muted-foreground">{t.dashboard.adminPlanBillingSectionHint ?? "Verify enrollment before approving. Sandbox payments are real Square test transactions; production requires a successful charge when upgrading."}</p>
                    {reviewEnrollment?.sub ? (
                      <ul className="text-sm text-muted-foreground space-y-1 list-none pl-0">
                        <li>
                          <span className="font-medium text-foreground">{t.dashboard.adminPlanBillingSubOnFile ?? "Plan on file"}:</span>{" "}
                          <span className="font-mono">{reviewEnrollment.sub.plan_id}</span>
                        </li>
                        {reviewEnrollment.sub.billing_start ? (
                          <li>
                            <span className="font-medium text-foreground">{t.dashboard.adminBillingPeriodStart ?? "Billing period start"}:</span>{" "}
                            {new Date(reviewEnrollment.sub.billing_start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </li>
                        ) : null}
                        {reviewEnrollment.sub.trial_ends_at ? (
                          <li>
                            <span className="font-medium text-foreground">{t.dashboard.adminTrialEnds ?? "Trial ends"}:</span>{" "}
                            {new Date(reviewEnrollment.sub.trial_ends_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </li>
                        ) : null}
                      </ul>
                    ) : (
                      <p className="text-sm text-amber-700 dark:text-amber-300">{t.dashboard.adminNoSubscriptionRow ?? "No pro_subscriptions row for this user."}</p>
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1.5">{t.dashboard.adminPlanPaymentsTitle ?? "Square charges (plan / non-booking)"}</p>
                      {reviewEnrollment?.paymentsError ? (
                        <p className="text-xs text-destructive">{reviewEnrollment.paymentsError}</p>
                      ) : reviewEnrollment && reviewEnrollment.payments.length > 0 ? (
                        <ul className="space-y-2 text-xs">
                          {reviewEnrollment.payments.map((row, idx) => (
                            <li key={`${row.created_at}-${idx}`} className="rounded border border-border/80 bg-background/80 p-2 font-mono">
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                <span>
                                  {(Number(row.amount_cents) / 100).toFixed(2)} {row.currency || "CAD"}
                                </span>
                                <span className="text-muted-foreground">{row.status}</span>
                                <span className="text-muted-foreground">
                                  {new Date(row.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              </div>
                              {row.square_payment_id ? (
                                <div className="mt-1 break-all text-[11px] text-muted-foreground">
                                  Square payment ID: {row.square_payment_id}
                                </div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t.dashboard.adminNoPlanPaymentsLogged ?? "No plan payment rows logged (e.g. trial with $0 today or downgrade). Subscription on file still proves they completed checkout."}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Applied {new Date(reviewProData.profile.created_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}</p>
                  {(() => {
                    const reviewUid = reviewProData.profile.user_id;
                    const reviewHasEnrollment = !adminSubsLoading && !!adminSubByUserId[reviewUid];
                    const reviewApproveLocked = acceptingId !== null || adminSubsLoading || !reviewHasEnrollment;
                    return (
                  <>
                  {!adminSubsLoading && !reviewHasEnrollment ? (
                    <Alert className="mt-4 border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-amber-950 dark:text-amber-50">
                        {t.dashboard.adminPaidPlanRequiredWarningTitle ?? "Paid plan or checkout required"}
                      </AlertTitle>
                      <AlertDescription className="text-amber-900/90 dark:text-amber-100/95">
                        {t.dashboard.adminPaidPlanRequiredWarning}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="flex flex-wrap gap-2 justify-end pt-4 border-t border-border">
                    <Button variant="outline" onClick={() => setReviewProId(null)}>{t.common.cancel ?? "Cancel"}</Button>
                    {(() => {
                      const rUid = reviewProData.profile.user_id;
                      const rPid = reviewProId as string;
                      const subPlan = adminSubByUserId[rUid]?.plan_id;
                      const profileT = String((reviewProData.profile as { subscription_tier?: string }).subscription_tier ?? "")
                        .toLowerCase()
                        .trim();
                      const billingT = (subPlan ?? "").toLowerCase().trim();
                      const canSyncReview = !!subPlan && profileT !== billingT && !adminSubsLoading;
                      return canSyncReview ? (
                        <Button
                          variant="outline"
                          onClick={() => void handleSyncTierFromSubscription(rPid, rUid)}
                          disabled={updatingTierId !== null}
                        >
                          {updatingTierId === rPid ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                          {t.dashboard.adminSyncTierFromBilling ?? "Sync tier from billing"}
                        </Button>
                      ) : null;
                    })()}
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { setDeclineProUserId(reviewProData.profile.user_id); setReviewProId(null); }}>{t.dashboard.decline}</Button>
                    <Button
                      onClick={() => { handleAcceptPro(reviewProData.profile.user_id); setReviewProId(null); }}
                      disabled={reviewApproveLocked}
                      title={reviewApproveLocked && !adminSubsLoading && !reviewHasEnrollment ? (t.dashboard.adminApproveBlockedTooltip ?? "") : undefined}
                    >
                      {acceptingId === reviewProData.profile.user_id ? <Loader2 size={14} className="animate-spin" /> : null} {t.dashboard.approve}
                    </Button>
                  </div>
                  </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-muted-foreground py-4">{t.dashboard.loadFailed ?? "Could not load application."}</p>
              )}
            </DialogContent>
          </Dialog>

        {user && !proProfile && !proProfileLoading && !isAdminDashboardShell && (
          <div className="mt-8 pt-6 border-t flex justify-center">
            <LiquidButton type="button" variant="secondary" whiteUntilHover onClick={() => setProProfileEditorOpen(true)}>
              {t.joinPros.completeProfile}
            </LiquidButton>
          </div>
        )}
      </div>

      {proProfile?.is_verified && (
        <aside
          id="dashboard-open-leads"
          className="mt-8 w-full max-w-4xl mx-auto lg:mt-0 lg:mx-0 lg:w-80 lg:max-w-none lg:shrink-0 lg:fixed lg:right-4 lg:top-24 lg:z-30 max-h-[min(70vh,calc(100vh-8rem))] lg:max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border bg-card p-4 shadow-sm scroll-mt-24"
        >
          <div className="hidden lg:flex justify-end mb-3">
            <WhatsNewMenu items={whatsNewItems} variant="desktop" />
          </div>
          <h3 className="font-heading font-bold text-foreground mb-3">{t.dashboard.availableJobsPanelTitle}</h3>
          {availableJobsNoCoordsBanner ? (
            <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/15 border border-amber-500/30 rounded-lg p-2 mb-3">
              {t.dashboard.availableJobsNoCoordsBanner}
            </p>
          ) : null}
          {availableJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.dashboard.availableJobsEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {displayJobs.map((job) => {
                const isLocked = lockedAvailableJobIds.has(job.id);
                return (
                <li
                  key={job.id}
                  className={`relative overflow-hidden rounded-lg border p-3 text-sm ${isLocked ? "cursor-pointer border-primary/20 bg-muted/20" : "border-border/50"}`}
                  onClick={isLocked ? showClientRequestUpgradePrompt : undefined}
                  onKeyDown={(event) => {
                    if (!isLocked) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      showClientRequestUpgradePrompt();
                    }
                  }}
                  role={isLocked ? "button" : undefined}
                  tabIndex={isLocked ? 0 : undefined}
                >
                  <div className={isLocked ? "pointer-events-none select-none blur-sm" : ""}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground line-clamp-1">{job.category || (locale === "fr" ? "Service" : "Service")}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{job.description}</p>
                        </div>
                        <p className="text-muted-foreground text-xs whitespace-nowrap shrink-0 mt-0.5">
                          {jobUpText(job.created_at)}
                        </p>
                      </div>
                  {job.distance_km != null && (
                    <p
                      className={`text-xs mt-1 ${job.outside_service_radius ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}
                    >
                      {(t.dashboard.availableJobsDistanceLine ?? "~{{km}} km · {{suffix}}")
                        .replace("{{km}}", String(Math.round(job.distance_km)))
                        .replace(
                          "{{suffix}}",
                          job.outside_service_radius
                            ? (t.dashboard.availableJobsOutsideRadius ?? "Outside your service radius")
                            : (t.dashboard.availableJobsNearYou ?? "near you"),
                        )}
                    </p>
                  )}
                  {job.budget_range && (
                    <p className="text-muted-foreground text-xs">{t.dashboard.budgetLabel ?? "Budget:"} {formatJobRequestBudget(job.budget_range)}</p>
                  )}
                  <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setSelectedJobForQuote(job)} disabled={isLocked}>
                    {t.dashboard.viewMoreSendQuote ?? "View more & send quote"}
                  </Button>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/35 px-4 text-center">
                      <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow">
                        {t.dashboard.requestLockedBadge ?? "Upgrade to unlock"}
                      </span>
                    </div>
                  )}
                </li>
                );
              })}
            </ul>
          )}
          {hasMoreJobs && (
            <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => setShowMoreJobs((v) => !v)}>
              {showMoreJobs ? (t.dashboard.showLessJobs ?? "Show less") : (t.dashboard.viewMoreAvailableJobs ?? "View more available jobs")}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background text-foreground border border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Description</Label>
              <Textarea
                value={editReqDescription}
                onChange={(e) => setEditReqDescription(e.target.value)}
                rows={4}
                className="resize-none text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Category</Label>
              <Input
                value={editReqCategory}
                onChange={(e) => setEditReqCategory(e.target.value)}
                className="text-foreground"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-budget-min" className="text-muted-foreground shrink-0">
                  {t.makeRequest.step5Min}
                </Label>
                <Input
                  id="edit-budget-min"
                  type="text"
                  inputMode="numeric"
                  placeholder={t.makeRequest.step5MinPlaceholder}
                  value={editReqBudgetMin}
                  onChange={(e) => setEditReqBudgetMin(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setEditReqBudgetMin((prev) => snapBudgetToTen(prev))}
                  className="w-28 text-foreground"
                />
              </div>
              <span className="text-muted-foreground">–</span>
              <div className="flex items-center gap-2">
                <Label htmlFor="edit-budget-max" className="text-muted-foreground shrink-0">
                  {t.makeRequest.step5Max}
                </Label>
                <Input
                  id="edit-budget-max"
                  type="text"
                  inputMode="numeric"
                  placeholder={t.makeRequest.step5MaxPlaceholder}
                  value={editReqBudgetMax}
                  onChange={(e) => setEditReqBudgetMax(e.target.value.replace(/[^\d]/g, ""))}
                  onBlur={() => setEditReqBudgetMax((prev) => snapBudgetToTen(prev))}
                  className="w-28 text-foreground"
                />
              </div>
            </div>
            <TimingAndDateFields
              timing={editReqTiming}
              onTimingChange={setEditReqTiming}
              preferredDate={editReqPreferredDate}
              onPreferredDateChange={setEditReqPreferredDate}
              timeWindow={editReqTimeWindow}
              onTimeWindowChange={setEditReqTimeWindow}
              availabilityMode={editReqAvailabilityMode}
              onAvailabilityModeChange={setEditReqAvailabilityMode}
              rangeStartDate={editReqRangeStartDate}
              rangeEndDate={editReqRangeEndDate}
              onRangeDateChange={(from, to) => {
                setEditReqRangeStartDate(from);
                setEditReqRangeEndDate(to);
              }}
              startHour={editReqStartHour}
              onStartHourChange={setEditReqStartHour}
              endHour={editReqEndHour}
              onEndHourChange={setEditReqEndHour}
              exactTime={editReqExactTime}
              onExactTimeChange={setEditReqExactTime}
              compact
            />
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

      <Dialog
        open={!!selectedJobForQuote}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedJobForQuote(null);
            setQuoteEstimatedDate(undefined);
            setQuoteEstimatedTime("");
            setQuoteEstimatedHours("");
            setQuoteTimeFrom("");
            setQuoteTimeTo("");
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-neutral-900 border-neutral-700 text-white [&_label]:text-white [&>button]:text-white [&>button]:hover:text-white [&_input]:bg-neutral-800 [&_input]:border-neutral-600 [&_textarea]:bg-neutral-800 [&_textarea]:border-neutral-600">
          <DialogHeader>
            <DialogTitle className="text-white">{t.dashboard.quoteDialogTitle}</DialogTitle>
          </DialogHeader>
          {selectedJobForQuote &&
            (() => {
              const job = selectedJobForQuote;
              const isExact = customerRequestedExactSlot(job);
              const bounds = effectiveCustomerTimeBounds(job);
              const disableCal = disableDatesOutsideCustomerChoice(job);
              const photoCount = Array.isArray(job.photo_urls) ? job.photo_urls.length : 0;
              const mode = (job.scheduling_mode ?? "").toLowerCase();
              const rangeStart = job.range_start_date ? parseScheduleDay(job.range_start_date) : undefined;
              const rangeEnd = job.range_end_date ? parseScheduleDay(job.range_end_date) : undefined;
              const prefDay = job.preferred_date ? parseScheduleDay(job.preferred_date) : undefined;

              return (
                <div className="space-y-4 text-white">
                  <div className="rounded-lg border border-white/15 bg-white/5 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                      {t.dashboard.quoteCustomerSection}
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-white">{job.description}</p>
                    <Separator className="bg-white/15" />
                    <dl className="grid gap-2 text-xs text-white/90">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-white/55">{t.dashboard.quoteSchedulingDetail}</dt>
                        <dd className="font-medium">{job.category}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-white/55 shrink-0">{t.dashboard.location}</dt>
                        <dd>
                          {[job.city, job.province].filter(Boolean).join(", ") || "?"}
                          {job.postal_code ? ` ? ${job.postal_code}` : ""}
                        </dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-white/55 shrink-0">{t.dashboard.quoteBudget}</dt>
                        <dd>{formatJobRequestBudget(job.budget_range)}</dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-white/55 shrink-0">{t.dashboard.quoteWhen}</dt>
                        <dd className="whitespace-pre-wrap">{whenNeededLabel(job)}</dd>
                      </div>
                      {mode === "range" && (rangeStart || rangeEnd) ? (
                        <div className="text-xs">
                          <span className="text-white/55">{t.dashboard.quoteDateRangeLabel}: </span>
                          {rangeStart ? format(rangeStart, "PP") : "?"}
                          {rangeEnd ? ` ? ${format(rangeEnd, "PP")}` : ""}
                        </div>
                      ) : null}
                      {mode === "specific_day" && prefDay ? (
                        <div className="text-xs">
                          <span className="text-white/55">{t.dashboard.quoteTheirDay}: </span>
                          {format(prefDay, "PP")}
                        </div>
                      ) : null}
                      {isExact ? (
                        <div className="text-xs">
                          <span className="text-white/55">{t.dashboard.quoteAgreedSchedule}: </span>
                          <span className="font-medium text-white">{formatCustomerExactSlotLine(job)}</span>
                        </div>
                      ) : null}
                      {job.window_time_start || job.window_time_end ? (
                        <div className="text-xs">
                          <span className="text-white/55">{t.dashboard.quoteAllowedWindow}: </span>
                          {[job.window_time_start, job.window_time_end].filter(Boolean).join(" ? ") || "?"}
                        </div>
                      ) : null}
                      {photoCount > 0 ? (
                        <p className="text-xs text-white/70">
                          {t.dashboard.quotePhotosAttached.replace("{{count}}", String(photoCount))}
                        </p>
                      ) : null}
                    </dl>
                  </div>

                  <Separator className="bg-white/20" />

                  {isExact ? (
                    <p className="text-sm text-white/85 leading-relaxed">{t.dashboard.quoteExactBanner}</p>
                  ) : (
                    <p className="text-sm text-white/85 leading-relaxed">{t.dashboard.quoteProposeBanner}</p>
                  )}

                  <div>
                    <Label className="text-white">{t.dashboard.quotePriceLabel}</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="e.g. 120"
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value.replace(/[^\d]/g, ""))}
                      className={`${INPUT_NO_NUMBER_SPIN} text-white placeholder:text-white/60`}
                    />
                  </div>

                  {!isExact ? (
                    <div className="space-y-3 rounded-lg border border-white/10 p-3">
                      <p className="text-sm font-medium text-white">{t.dashboard.quoteYourProposal}</p>
                      <div>
                        <Label className="text-white text-xs">{t.dashboard.quotePickDate}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-1 w-full justify-start border-neutral-600 bg-neutral-800 text-left font-normal text-white hover:bg-neutral-700 hover:text-white sm:max-w-sm"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                              {quoteEstimatedDate ? format(quoteEstimatedDate, "PPP") : "?"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto border-neutral-700 bg-neutral-900 p-0 text-white" align="start">
                            <Calendar
                              mode="single"
                              selected={quoteEstimatedDate}
                              onSelect={setQuoteEstimatedDate}
                              disabled={disableCal}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {bounds ? (
                        <p className="text-xs text-white/65">
                          {t.dashboard.quoteAllowedWindow}: {bounds.from}?{bounds.to}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-white text-xs">{t.dashboard.quoteTimeFrom}</Label>
                          <Input
                            type="time"
                            value={quoteTimeFrom}
                            onChange={(e) => setQuoteTimeFrom(e.target.value)}
                            min={bounds?.from}
                            max={bounds?.to}
                            className="mt-1 text-white placeholder:text-white/60"
                          />
                        </div>
                        <div>
                          <Label className="text-white text-xs">{t.dashboard.quoteTimeTo}</Label>
                          <Input
                            type="time"
                            value={quoteTimeTo}
                            onChange={(e) => setQuoteTimeTo(e.target.value)}
                            min={bounds?.from}
                            max={bounds?.to}
                            className="mt-1 text-white placeholder:text-white/60"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <Label className="text-white">{t.dashboard.quoteWorkDuration}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      step={1}
                      placeholder="e.g. 3"
                      value={quoteEstimatedHours}
                      onChange={(e) => setQuoteEstimatedHours(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                      onBlur={() => {
                        const hours = Number(quoteEstimatedHours);
                        if (!quoteEstimatedHours) return;
                        setQuoteEstimatedHours(String(Math.min(24, Math.max(1, hours || 1))));
                      }}
                      className={`mt-1 ${INPUT_NO_NUMBER_SPIN} text-white placeholder:text-white/60`}
                    />
                  </div>
                  <div>
                    <Label className="text-white">{t.dashboard.quoteOptionalMessage}</Label>
                    <Textarea
                      placeholder="Short note for the customer"
                      value={quoteMessage}
                      onChange={(e) => setQuoteMessage(e.target.value)}
                      rows={3}
                      className="mt-1 text-white placeholder:text-white/60"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedJobForQuote(null);
                        setQuoteEstimatedDate(undefined);
                        setQuoteEstimatedTime("");
                        setQuoteEstimatedHours("");
                        setQuoteTimeFrom("");
                        setQuoteTimeTo("");
                      }}
                      className="border-white text-white hover:bg-white/10 hover:text-white"
                    >
                      {t.common?.cancel ?? "Cancel"}
                    </Button>
                    <Button onClick={handleSendQuote} disabled={sendingQuote}>
                      {sendingQuote && <Loader2 size={14} className="animate-spin mr-2" />}
                      {t.dashboard.quoteSend}
                    </Button>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!quotePaymentTarget}
        onOpenChange={(open) => {
          if (!open) {
            setQuotePaymentTarget(null);
            setQuotePaymentError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t.dashboard.quotePayTitle ?? (locale === "fr" ? "Payer par carte" : "Pay by card")}
            </DialogTitle>
          </DialogHeader>
          {quotePaymentTarget ? (
            (() => {
              const baseCents = Math.max(50, quotePaymentTarget.quote.price_cents ?? 0);
              const invoice = computeBookingInvoiceFromBaseCents(baseCents);
              return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t.dashboard.quotePaySubtitle ??
                  (locale === "fr"
                    ? "Payez par carte pour accepter cette soumission."
                    : "Pay by credit card to accept this quote.")}
              </p>
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span>{t.dashboard.quotePayQuoteAmount ?? (locale === "fr" ? "Montant de la soumission" : "Quote amount")}</span>
                  <span>${(baseCents / 100).toFixed(2)} CAD</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>{t.dashboard.invoiceGst ?? "GST (5%)"}</span>
                  <span>${invoice.gst.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>{t.dashboard.invoiceQst ?? "QST (9.975%)"}</span>
                  <span>${invoice.qst.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-xs">
                  <span>{t.dashboard.invoiceProcessing ?? "Processing fee"}</span>
                  <span>${invoice.processingFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>{t.dashboard.quotePayTotalDue ?? (locale === "fr" ? "Total à payer" : "Total due")}</span>
                  <span>${invoice.totalDollars} CAD</span>
                </div>
              </div>
              <SquareBookingPayment
                amountCents={invoice.totalCents}
                baseAmountCents={baseCents}
                squareLocationId={quoteProSquareLoc}
                currency="cad"
                proProfileId={quotePaymentTarget.quote.pro_profile_id}
                clientId={user.id}
                audience="client"
                onSuccess={() => {
                  void handleAcceptQuoteAfterPayment();
                }}
                onError={(message) => setQuotePaymentError(message)}
              />
              {quotePaymentError ? (
                <p className="text-sm text-destructive">{quotePaymentError}</p>
              ) : null}
            </div>
              );
            })()
          ) : null}
        </DialogContent>
      </Dialog>
      <Suspense fallback={null}>
        <ProProfileEditorDialog
          open={proProfileEditorOpen}
          onOpenChange={setProProfileEditorOpen}
          allowDirectCreate
          onSaved={() => setProProfileRefreshKey((k) => k + 1)}
        />
      </Suspense>
      <ProBookingRequestDetailDialog
        open={proBookingDetailId != null}
        onOpenChange={(open) => {
          if (!open) setProBookingDetailId(null);
        }}
        booking={proBookingDetail}
        serviceLocationMode={proProfile ? profileDefaultMode(proProfile) : "travel"}
        clientName={proBookingDetail ? clientProfiles[proBookingDetail.client_id]?.full_name : null}
        clientPhone={proBookingDetail ? clientProfiles[proBookingDetail.client_id]?.phone : null}
        clientIdentityVerified={
          proBookingDetail
            ? (clientProfiles[proBookingDetail.client_id]?.booking_id_verification_status ?? "") === "verified"
            : false
        }
        canSeePhone={proBookingDetail ? proMaySeeClientContactInDetail(proBookingDetail) : false}
        statusLabel={proBookingDetail ? proBookingStatusLabel(proBookingDetail.status) : undefined}
      />
      {user ? (
        <ClientBookingPayDialog
          open={payBookingTarget != null}
          onOpenChange={(open) => {
            if (!open) {
              setPayBookingTarget(null);
              setPayBookingSquareLoc(null);
            }
          }}
          booking={payBookingTarget}
          businessName={payBookingTarget?.business_name}
          squareLocationId={payBookingSquareLoc}
          clientId={user.id}
          onPaid={() => {
            if (payBookingTarget) {
              void (async () => {
                const { data } = await supabase
                  .from("payments")
                  .select("booking_id, amount_cents, currency, square_payment_id, status")
                  .eq("booking_id", payBookingTarget.id)
                  .maybeSingle();
                if (data?.booking_id) {
                  setBookingPaymentsById((prev) => ({ ...prev, [data.booking_id!]: data as typeof prev[string] }));
                }
              })();
            }
            setPayBookingTarget(null);
            setPayBookingSquareLoc(null);
          }}
        />
      ) : null}
      {user?.id && dashTourSegment ? (
        <DashboardTour
          userId={user.id}
          segment={dashTourSegment}
          open={dashTourOpen}
          onClose={() => {
            if (dashTourSegment) dashTourSessionSkip.current.add(dashTourSegment);
            setDashTourOpen(false);
          }}
          onFinished={() => {
            setDashTourTick((n) => n + 1);
            setDashTourOpen(false);
          }}
        />
      ) : null}
    </Layout>
  );
}
