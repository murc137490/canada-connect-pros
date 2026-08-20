import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Briefcase, Check,
  Loader2, ShieldCheck, CalendarCheck, CreditCard, ChevronRight, ChevronDown, Share2, Info, X, Heart
} from "lucide-react";
import { serviceCategories } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import StarRating from "@/components/pro/StarRating";
import LicenseBadge from "@/components/pro/LicenseBadge";
import ReviewSection from "@/components/pro/ReviewSection";
import AvailabilityCalendar, { type UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import { isWholeDayUnavailable, getUnavailableSlots, getUnavailableNote } from "@/lib/unavailableDates";
import type { UnavailableDayStored } from "@/lib/unavailableDates";
import { parseAvailabilityToWeekly } from "@/components/pro/ProScheduleEditor";
import RecommendationSidebar from "@/components/pro/RecommendationSidebar";
import TermsAcceptance from "@/components/TermsAcceptance";
import BookingRequestConfirm from "@/components/BookingRequestConfirm";
import { phoneDigits } from "@/lib/canadianPhone";
import {
  buildBookingInvoiceSnapshotV2,
  buildServiceDescriptionDetailed,
} from "@/lib/bookingInvoiceSnapshot";
import { buildClientInvoiceContactBlock } from "@/lib/clientInvoiceContactBlock";
import type { AvailabilityState } from "@/components/WeekdayAvailability";
import { useAuth } from "@/contexts/AuthContext";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { splitBioAndLanguages } from "@/lib/parseBioLanguages";
import ClickSpark from "@/components/ClickSpark";
import StarBorder from "@/components/StarBorder";
import { getAccentHex } from "@/data/proAccentColors";
import {
  effectiveProTier,
  hasFeaturedPublicProfileLook,
  hasBookingAssistantAI,
  hasGrowthServiceExtras,
  isPaidSubscriptionPlanId,
} from "@/lib/proTierFeatures";
import {
  formatResolvedCancelPolicyText,
  normalizeBookingCancelFeePercent,
  normalizeBookingCancelPolicy,
  resolveServiceCancelPolicy,
  type ResolvedCancelPolicy,
} from "@/lib/bookingCancelPolicy";
import BookingServiceAssistantPanel from "@/components/BookingServiceAssistantPanel";
import { labelProService, catalogEnNameForProService } from "@/lib/proServiceLabel";
import { formatDurationLabel } from "@/lib/durationMinutes";
import { formatBookingTimeRange } from "@/lib/bookingTimeRange";
import { buildProPageDarkTones, buildProPageLightTones } from "@/lib/brandProPageTones";
import {
  persistClientBookingIdVerificationOnProfile,
  assertClientBookingIdFile,
} from "@/lib/clientBookingIdVerification";
import { useTheme } from "next-themes";
import { resolveStorageDisplayUrl } from "@/lib/resolveStorageUrl";
import { isLightHexColor } from "@/lib/contrastOnHex";
import {
  bookingCheckoutLoginPath,
  clearBookingCheckoutResume,
  loadBookingCheckoutResume,
  saveBookingCheckoutResume,
} from "@/lib/bookingCheckoutResume";
import { checkTravelDistanceForBooking, resolveBookingTravelSnapshot } from "@/lib/bookingTravelValidation";
import { fetchDrivingLeg, formatDriveDurationLabel, isWithinServiceRadius, type DrivingLegResult } from "@/lib/drivingDistance";
import { geocodeAddress } from "@/lib/geocode";
import { BROWSE_POSTAL_CHANGED_EVENT, getBrowsePostalLocation } from "@/lib/browsePostalStorage";
import {
  resolveServiceWorkspaceCoords,
  shouldShowTravelDistancePreview,
  shouldShowWorkspaceDistancePreview,
} from "@/lib/serviceWorkspaceLocation";
import StorageDisplayImage from "@/components/StorageDisplayImage";
import {
  bookingUsesTravelDistance,
  effectiveServiceLocationMode,
  profileDefaultMode,
  profileOffers,
  resolveBookingLocationChoice,
  type ServiceLocationChoice,
} from "@/lib/serviceLocationMode";

interface ProData {
  id: string;
  user_id: string;
  business_name: string;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  service_at_workspace_only: boolean | null;
  offers_workspace?: boolean | null;
  offers_travel?: boolean | null;
  service_radius_km: number | null;
  price_min: number | null;
  price_max: number | null;
  availability: string | null;
  phone: string | null;
  website: string | null;
  years_experience: number;
  is_verified: boolean;
  page_template?: string | null;
  page_primary_color?: string | null;
  page_secondary_color?: string | null;
  page_accent_color?: string | null;
  page_background_color?: string | null;
  page_header_text?: string | null;
  pro_accent_color?: string | null;
  service_tags?: string[] | null;
  banner_image_url?: string | null;
  unavailable_dates?: UnavailableDatesMap;
  available_date_overrides?: string[];
  subscription_tier?: string | null;
  legal_business_name?: string | null;
  business_address?: string | null;
  gst_registration_number?: string | null;
  qst_registration_number?: string | null;
  square_location_id?: string | null;
  booking_cancel_policy?: string | null;
  booking_cancel_fee_percent?: number | null;
}

export default function ProProfilePage() {
  const { proId } = useParams<{ proId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPlatformAdmin: isMonitorAdmin, ready: platformAdminReady } = usePlatformAdmin();
  const adminCannotBook = platformAdminReady && isMonitorAdmin;
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";

  const serviceLineLabel = (svc: { service_slug: string; category_slug: string; display_name?: string | null }) =>
    labelProService(
      { service_slug: svc.service_slug, display_name: svc.display_name ?? null },
      locale,
      catalogEnNameForProService(svc.category_slug, svc.service_slug, serviceCategories)
    );

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      toast({ title: t.terms.requestBooking, description: t.terms.bookingRequestSent });
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("payment"); return next; }, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, t.terms.requestBooking, t.terms.bookingRequestSent]);

  const [pro, setPro] = useState<ProData | null>(null);
  const [proBillingPlanId, setProBillingPlanId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null; is_primary?: boolean }[]>([]);
  const [services, setServices] = useState<
    {
      service_slug: string;
      category_slug: string;
      description: string | null;
      display_name?: string | null;
      custom_price_min: number | null;
      custom_price_max: number | null;
      duration_minutes?: number | null;
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
    }[]
  >([]);
  const [browsePostalTick, setBrowsePostalTick] = useState(0);
  const [clientProfileAddressRaw, setClientProfileAddressRaw] = useState<string | null>(null);
  const [clientProfilePhone, setClientProfilePhone] = useState<string | null>(null);
  const [bookingLocationChoice, setBookingLocationChoice] = useState<ServiceLocationChoice | null>(null);
  const [travelToClientPreview, setTravelToClientPreview] = useState<DrivingLegResult | null>(null);
  const [workspaceVisitPreview, setWorkspaceVisitPreview] = useState<DrivingLegResult | null>(null);
  const [bookingDistanceLoading, setBookingDistanceLoading] = useState(false);
  const [isProSaved, setIsProSaved] = useState(false);
  const [licenses, setLicenses] = useState<{ license_number: string; license_type: string; is_verified: boolean }[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
  const [bookingCancelPolicyAccepted, setBookingCancelPolicyAccepted] = useState(false);
  const [bookingCancelPolicyDetailsOpen, setBookingCancelPolicyDetailsOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4>(1);
  const [bookingPhotoWithIdFile, setBookingPhotoWithIdFile] = useState<File | null>(null);
  /** Storage path on profiles when user already completed verification on a past booking. */
  const [clientBookingIdPath, setClientBookingIdPath] = useState<string | null>(null);
  const [bookingClientRenewAnnually, setBookingClientRenewAnnually] = useState(false);
  const [proBookings, setProBookings] = useState<
    {
      id: string;
      created_at?: string;
      preferred_date?: string | null;
      preferred_time?: string | null;
      service_duration_minutes?: number | null;
    }[]
  >([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [resolvedPhotoUrls, setResolvedPhotoUrls] = useState<Record<string, string>>({});
  const [lightboxImageDark, setLightboxImageDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"about" | "services" | "credentials">("about");
  const [selectedBookingDate, setSelectedBookingDate] = useState<string | null>(null);
  const [selectedBookingTime, setSelectedBookingTime] = useState<string | null>(null);
  const [selectedBookingService, setSelectedBookingService] = useState<typeof services[0] | null>(null);
  const [clientInvoiceAddress, setClientInvoiceAddress] = useState<string | null>(null);
  const [allServicesModalOpen, setAllServicesModalOpen] = useState(false);
  const viewRecordedRef = useRef(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  const bookingServiceMode = useMemo(() => {
    if (!pro || !selectedBookingService) return "workspace" as const;
    return effectiveServiceLocationMode(pro, selectedBookingService);
  }, [pro, selectedBookingService]);

  const resolvedBookingChoice = useMemo(
    () => resolveBookingLocationChoice(bookingServiceMode, bookingLocationChoice),
    [bookingServiceMode, bookingLocationChoice],
  );

  const proLocationOffers = useMemo(
    () => (pro ? profileOffers(pro) : { offersWorkspace: false, offersTravel: false }),
    [pro],
  );

  useEffect(() => {
    const onBrowsePostal = () => setBrowsePostalTick((n) => n + 1);
    window.addEventListener(BROWSE_POSTAL_CHANGED_EVENT, onBrowsePostal);
    return () => window.removeEventListener(BROWSE_POSTAL_CHANGED_EVENT, onBrowsePostal);
  }, []);

  const showWorkspaceDistancePreview = useMemo(
    () =>
      selectedBookingService
        ? shouldShowWorkspaceDistancePreview(bookingServiceMode, resolvedBookingChoice)
        : false,
    [selectedBookingService, bookingServiceMode, resolvedBookingChoice],
  );

  const showTravelDistancePreview = useMemo(
    () =>
      selectedBookingService
        ? shouldShowTravelDistancePreview(bookingServiceMode, resolvedBookingChoice)
        : false,
    [selectedBookingService, bookingServiceMode, resolvedBookingChoice],
  );

  const clientOutsideTravelZone = useMemo(
    () =>
      travelToClientPreview != null &&
      pro != null &&
      !isWithinServiceRadius(travelToClientPreview.distanceKm, pro.service_radius_km),
    [travelToClientPreview, pro],
  );

  const displayedDistancePreview = useMemo((): DrivingLegResult | null => {
    if (showWorkspaceDistancePreview) return workspaceVisitPreview;
    if (bookingServiceMode === "travel") return clientOutsideTravelZone ? null : travelToClientPreview;
    if (bookingServiceMode === "both" && clientOutsideTravelZone) return workspaceVisitPreview;
    if (showTravelDistancePreview) return travelToClientPreview;
    return null;
  }, [
    showWorkspaceDistancePreview,
    showTravelDistancePreview,
    bookingServiceMode,
    clientOutsideTravelZone,
    workspaceVisitPreview,
    travelToClientPreview,
  ]);

  useEffect(() => {
    if (!bookingDialogOpen || !pro || !selectedBookingService) {
      setTravelToClientPreview(null);
      setWorkspaceVisitPreview(null);
      setBookingDistanceLoading(false);
      return;
    }

    const needTravel = bookingServiceMode === "travel" || bookingServiceMode === "both";
    const needWorkspace = bookingServiceMode === "workspace" || bookingServiceMode === "both";
    if (!needTravel && !needWorkspace) {
      setTravelToClientPreview(null);
      setWorkspaceVisitPreview(null);
      setBookingDistanceLoading(false);
      return;
    }

    let cancelled = false;
    setBookingDistanceLoading(true);

    void (async () => {
      const browse = getBrowsePostalLocation();
      let origin: { lat: number; lng: number } | null = browse
        ? { lat: browse.lat, lng: browse.lng }
        : null;
      if (!origin && clientProfileAddressRaw?.trim()) {
        const clientGeo = await geocodeAddress(clientProfileAddressRaw);
        if (clientGeo) origin = { lat: clientGeo.lat, lng: clientGeo.lng };
      }

      if (!origin) {
        if (!cancelled) {
          setTravelToClientPreview(null);
          setWorkspaceVisitPreview(null);
          setBookingDistanceLoading(false);
        }
        return;
      }

      const fetches: Promise<void>[] = [];

      if (needTravel && pro.latitude != null && pro.longitude != null) {
        fetches.push(
          fetchDrivingLeg(origin, { lat: pro.latitude, lng: pro.longitude }).then((leg) => {
            if (!cancelled) setTravelToClientPreview(leg);
          }),
        );
      } else if (!cancelled) {
        setTravelToClientPreview(null);
      }

      if (needWorkspace) {
        const ws = resolveServiceWorkspaceCoords(selectedBookingService, pro);
        if (ws) {
          fetches.push(
            fetchDrivingLeg(origin, { lat: ws.lat, lng: ws.lng }).then((leg) => {
              if (!cancelled) setWorkspaceVisitPreview(leg);
            }),
          );
        } else if (!cancelled) {
          setWorkspaceVisitPreview(null);
        }
      } else if (!cancelled) {
        setWorkspaceVisitPreview(null);
      }

      await Promise.all(fetches);
      if (!cancelled) setBookingDistanceLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bookingDialogOpen,
    pro,
    selectedBookingService,
    clientProfileAddressRaw,
    browsePostalTick,
    bookingServiceMode,
  ]);

  useEffect(() => {
    if (!clientOutsideTravelZone || !proLocationOffers.offersWorkspace) return;
    if (bookingLocationChoice === "travel") {
      setBookingLocationChoice("workspace");
    }
  }, [clientOutsideTravelZone, proLocationOffers.offersWorkspace, bookingLocationChoice]);

  useEffect(() => {
    if (!bookingDialogOpen || bookingServiceMode !== "both") return;
    if (bookingLocationChoice == null) {
      setBookingLocationChoice("workspace");
    }
  }, [bookingDialogOpen, bookingServiceMode, bookingLocationChoice]);

  const travelToClientBlocked =
    clientOutsideTravelZone &&
    (bookingServiceMode === "travel" ||
      (bookingServiceMode === "both" && resolvedBookingChoice === "travel"));

  /** Deep-link ?service=category/slug - must run after `services` state exists (avoid TDZ crash). */
  useEffect(() => {
    const raw = searchParams.get("service");
    if (!raw || services.length === 0) return;
    const decoded = decodeURIComponent(raw);
    const slash = decoded.indexOf("/");
    if (slash < 0) return;
    const cat = decoded.slice(0, slash);
    const slug = decoded.slice(slash + 1);
    const match = services.find((s) => s.category_slug === cat && s.service_slug === slug);
    if (match) {
      setSelectedBookingService(match);
      setBookingDialogOpen(true);
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev);
        n.delete("service");
        return n;
      }, { replace: true });
    }
  }, [searchParams, services, setSearchParams]);

  const persistBookingCheckoutForLogin = useCallback(() => {
    if (!proId) return;
    saveBookingCheckoutResume({
      proId,
      selectedBookingDate,
      selectedBookingTime,
      serviceCategorySlug: selectedBookingService?.category_slug ?? null,
      serviceSlug: selectedBookingService?.service_slug ?? null,
      bookingTermsAccepted,
      bookingClientRenewAnnually,
    });
  }, [
    proId,
    selectedBookingDate,
    selectedBookingTime,
    selectedBookingService,
    bookingTermsAccepted,
    bookingClientRenewAnnually,
  ]);

  /** After login: reopen booking at payment step with saved selections. */
  useEffect(() => {
    if (!proId || !user?.id || services.length === 0) return;
    const wantsResume = searchParams.get("resumeBooking") === "1";
    const saved = loadBookingCheckoutResume(proId);
    if (!wantsResume && !saved) return;

    const resume = saved;
    if (!resume) {
      if (wantsResume) {
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.delete("resumeBooking");
            return n;
          },
          { replace: true },
        );
      }
      return;
    }

    if (resume.serviceCategorySlug && resume.serviceSlug) {
      const match = services.find(
        (s) => s.category_slug === resume.serviceCategorySlug && s.service_slug === resume.serviceSlug,
      );
      if (match) setSelectedBookingService(match);
    }
    setSelectedBookingDate(resume.selectedBookingDate);
    setSelectedBookingTime(resume.selectedBookingTime);
    setBookingTermsAccepted(resume.bookingTermsAccepted);
    setBookingClientRenewAnnually(resume.bookingClientRenewAnnually);
    setBookingStep(4);
    setBookingDialogOpen(true);
    clearBookingCheckoutResume();
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("resumeBooking");
        return n;
      },
      { replace: true },
    );
  }, [proId, user?.id, services, searchParams, setSearchParams]);

  useEffect(() => {
    if (!user?.id) {
      setClientInvoiceAddress(null);
      setClientBookingIdPath(null);
      return;
    }
    if (!bookingDialogOpen) return;
    void supabase
      .from("profiles")
      .select("address, full_name, phone, postal_code, booking_id_verification_photo_path")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Profile load for booking:", error.message);
          void supabase
            .from("profiles")
            .select("address, full_name, phone, postal_code")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data: d2 }) => {
              setClientInvoiceAddress(buildClientInvoiceContactBlock(d2) || null);
              setClientBookingIdPath(null);
            });
          return;
        }
        setClientInvoiceAddress(buildClientInvoiceContactBlock(data) || null);
        const rawAddr = typeof data?.address === "string" ? data.address.trim() : "";
        const rawPostal = typeof data?.postal_code === "string" ? data.postal_code.trim() : "";
        setClientProfileAddressRaw(rawAddr || rawPostal || null);
        setClientProfilePhone(typeof data?.phone === "string" ? data.phone.trim() : null);
        const p = data?.booking_id_verification_photo_path;
        setClientBookingIdPath(typeof p === "string" && p.trim() ? p.trim() : null);
      });
  }, [user?.id, bookingDialogOpen]);

  // Detect if lightbox image is dark so close button can be white or black for contrast
  useEffect(() => {
    if (!lightboxPhoto) {
      setLightboxImageDark(false);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        const avg = sum / (data.length / 4);
        setLightboxImageDark(avg < 128);
      } catch {
        setLightboxImageDark(false);
      }
    };
    img.onerror = () => setLightboxImageDark(false);
    img.src = lightboxPhoto;
  }, [lightboxPhoto]);

  // We allow booking multiple appointments per day; time selection below blocks conflicting times.
  const busyDatesList: string[] = [];
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const handleCalendarDayClick = (dateStr: string, isAvailableByWeekday: boolean) => {
    if (dateStr < todayStr) {
      toast({ title: t.auth.toastError, description: t.terms.bookingDateNotInPast ?? "You cannot book a date in the past.", variant: "destructive" });
      return;
    }
    setSelectedBookingDate(dateStr);
    setSelectedBookingTime(null);
    setBookingDialogOpen(true);
  };

  const weekdayKeyFromDateStr = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00`);
    // JS getDay: 0=Sun..6=Sat, while our availability keys are "sun".."sat"
    return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d.getDay()] as keyof AvailabilityState;
  };

  const bookingTimeOptions = useMemo(() => {
    if (!pro || !selectedBookingDate) return [];

    const weekly = parseAvailabilityToWeekly(pro.availability ?? null);
    const weekdayKey = weekdayKeyFromDateStr(selectedBookingDate);
    const dayState = weekly[weekdayKey];

    const isDayOverride = (pro.available_date_overrides ?? []).includes(selectedBookingDate);

    const exceptions = pro.unavailable_dates?.[selectedBookingDate];
    if (isWholeDayUnavailable(exceptions)) return [];

    const exceptionSlots = getUnavailableSlots(exceptions);

    const parseHHMMToMinutes = (s: string) => {
      const m = s.match(/^\s*(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };

    const scheduleStartMin = isDayOverride ? 9 * 60 : parseHHMMToMinutes(dayState.start);
    const scheduleEndMin = isDayOverride ? 17 * 60 : parseHHMMToMinutes(dayState.end);
    if (!isDayOverride && !dayState.available) return [];
    if (scheduleStartMin == null || scheduleEndMin == null || scheduleEndMin <= scheduleStartMin) return [];
    const newBookingDuration = selectedBookingService?.duration_minutes ?? 60;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = selectedBookingDate === todayStr;

    const candidateStarts = new Set<string>();
    for (let startMin = scheduleStartMin; startMin + newBookingDuration <= scheduleEndMin; startMin += 60) {
      const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
      const mm = String(startMin % 60).padStart(2, "0");
      const label = `${hh}:${mm}`;
      candidateStarts.add(label);
    }

    const candidates = Array.from(candidateStarts).sort();

    // Remove time slots that overlap with unavailable exceptions.
    const filteredByExceptions = candidates.filter((time) => {
      const startMin = parseHHMMToMinutes(time);
      if (startMin == null) return false;
      const endMin = startMin + newBookingDuration;

      for (const slot of exceptionSlots) {
        const slotStart = parseHHMMToMinutes(slot.start);
        const slotEnd = parseHHMMToMinutes(slot.end);
        if (slotStart == null || slotEnd == null) continue;
        const overlaps = startMin < slotEnd && endMin > slotStart;
        if (overlaps) return false;
      }
      return true;
    });

    // Remove starts that overlap existing bookings for this date.
    const bookingsForDate = proBookings.filter((b) => {
      const dateFromPreferred = b.preferred_date ? String(b.preferred_date) : null;
      const dateFromCreatedAt = b.created_at ? String(b.created_at).slice(0, 10) : null;
      return (dateFromPreferred ?? dateFromCreatedAt) === selectedBookingDate;
    });

    const bookedRanges = bookingsForDate
      .map((b) => {
        const raw = b.preferred_time ? String(b.preferred_time) : b.created_at ? String(b.created_at).slice(11, 16) : "";
        const start = parseHHMMToMinutes(raw);
        if (start == null) return null;
        const duration = b.service_duration_minutes ?? 60;
        return { start, end: start + duration };
      })
      .filter((x): x is { start: number; end: number } => !!x);

    const filteredByBookings = filteredByExceptions.filter((time) => {
      const startMin = parseHHMMToMinutes(time);
      if (startMin == null) return false;
      const endMin = startMin + newBookingDuration;
      return !bookedRanges.some((booked) => startMin < booked.end && endMin > booked.start);
    });

    // If booking for today, don't allow selecting times in the past.
    const filteredByNow = filteredByBookings.filter((time) => {
      if (!isToday) return true;
      const startMin = parseHHMMToMinutes(time);
      if (startMin == null) return false;
      return startMin > nowMinutes;
    });

    return filteredByNow;
  }, [pro, selectedBookingDate, selectedBookingService?.duration_minutes, proBookings, todayStr]);

  useEffect(() => {
    if (!selectedBookingTime) return;
    if (!bookingTimeOptions.includes(selectedBookingTime)) setSelectedBookingTime(null);
  }, [bookingTimeOptions, selectedBookingTime]);

  const scheduleClientNote = useMemo(() => {
    if (!pro || !selectedBookingDate) return "";
    const ex = pro.unavailable_dates?.[selectedBookingDate] as UnavailableDayStored | undefined;
    return (getUnavailableNote(ex) ?? "").trim();
  }, [pro, selectedBookingDate]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: pro?.business_name ?? "", url });
        toast({ title: t.common?.shared ?? "Link copied", description: "" });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: t.common?.linkCopied ?? "Link copied", description: "" });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t.common?.linkCopied ?? "Link copied", description: "" });
    }
  };

  useEffect(() => {
    if (!proId) return;
    const fetch = async () => {
      setLoading(true);

      const { data: proData } = await supabase
        .from("pro_profiles")
        .select("*")
        .eq("id", proId)
        .eq("is_verified", true)
        .single();

      if (!proData) { setLoading(false); return; }
      const { data: subForTier } = await supabase
        .from("pro_subscriptions")
        .select("plan_id")
        .eq("user_id", (proData as { user_id: string }).user_id)
        .maybeSingle();
      setProBillingPlanId(typeof subForTier?.plan_id === "string" ? subForTier.plan_id : null);
      setPro(proData as ProData);

      // Parallel fetches (services loaded with display_name fallback if column missing)
      const [profileRes, photosRes, licensesRes, ratingRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", proData.user_id).single(),
        supabase.from("pro_photos").select("id, url, caption, is_primary").eq("pro_profile_id", proId).order("is_primary", { ascending: false }),
        supabase.from("pro_licenses").select("license_number, license_type, is_verified").eq("pro_profile_id", proId),
        supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: proId }),
        supabase
          .from("bookings")
          .select("id, created_at, preferred_date, preferred_time, service_duration_minutes")
          .eq("pro_profile_id", proId)
          .in("status", ["pending", "accepted", "completed"]),
      ]);

      let servicesRows: {
        service_slug: string;
        category_slug: string;
        description: string | null;
        display_name?: string | null;
        custom_price_min: number | null;
        custom_price_max: number | null;
        duration_minutes?: number | null;
        auto_reply_message?: string | null;
        renewal_interval_months?: number | null;
        cancel_policy?: string | null;
        cancel_fee_type?: string | null;
        cancel_fee_percent?: number | null;
        cancel_fee_cents?: number | null;
      }[] = [];
      const sFull = await supabase
        .from("pro_services")
        .select("service_slug, category_slug, description, display_name, custom_price_min, custom_price_max, duration_minutes, auto_reply_message, renewal_interval_months, location_mode, workspace_address, workspace_latitude, workspace_longitude, cancel_policy, cancel_fee_type, cancel_fee_percent, cancel_fee_cents")
        .eq("pro_profile_id", proId);
      if (sFull.error && /auto_reply_message|renewal_interval_months|cancel_policy|cancel_fee|schema cache/i.test(`${sFull.error.message || ""}`)) {
        const fb = await supabase
          .from("pro_services")
          .select("service_slug, category_slug, description, display_name, custom_price_min, custom_price_max, duration_minutes")
          .eq("pro_profile_id", proId);
        if (!fb.error && fb.data) {
          servicesRows = (fb.data as typeof servicesRows).map((r) => ({
            ...r,
            auto_reply_message: null,
            renewal_interval_months: null,
          }));
        }
      } else if (sFull.error && `${sFull.error.message || ""}`.includes("duration_minutes")) {
        const sWithName = await supabase
          .from("pro_services")
          .select("service_slug, category_slug, description, display_name, custom_price_min, custom_price_max")
          .eq("pro_profile_id", proId);
        if (sWithName.error && `${sWithName.error.message || ""}`.includes("display_name")) {
          const fb = await supabase
            .from("pro_services")
            .select("service_slug, category_slug, description, custom_price_min, custom_price_max")
            .eq("pro_profile_id", proId);
          servicesRows = ((fb.data || []) as typeof servicesRows).map((r) => ({ ...r, display_name: null, duration_minutes: null }));
        } else {
          servicesRows = ((sWithName.data as typeof servicesRows) || []).map((r) => ({ ...r, duration_minutes: null }));
        }
      } else if (sFull.error && `${sFull.error.message || ""}`.includes("display_name")) {
        const fb = await supabase
          .from("pro_services")
          .select("service_slug, category_slug, description, custom_price_min, custom_price_max, duration_minutes")
          .eq("pro_profile_id", proId);
        if (fb.error && `${fb.error.message || ""}`.includes("duration_minutes")) {
          const fb2 = await supabase
            .from("pro_services")
            .select("service_slug, category_slug, description, custom_price_min, custom_price_max")
            .eq("pro_profile_id", proId);
          servicesRows = ((fb2.data || []) as typeof servicesRows).map((r) => ({ ...r, display_name: null, duration_minutes: null }));
        } else {
          servicesRows = ((fb.data || []) as typeof servicesRows).map((r) => ({ ...r, display_name: null }));
        }
      } else {
        servicesRows = (sFull.data as typeof servicesRows) || [];
      }

      let bookingRows =
        (bookingsRes.data as {
          id: string;
          created_at?: string;
          preferred_date?: string | null;
          preferred_time?: string | null;
          service_duration_minutes?: number | null;
        }[] | null) || [];
      if (bookingsRes.error && `${bookingsRes.error.message || ""}`.includes("service_duration_minutes")) {
        const fb = await supabase
          .from("bookings")
          .select("id, created_at, preferred_date, preferred_time")
          .eq("pro_profile_id", proId)
          .in("status", ["pending", "accepted", "completed"]);
        bookingRows = ((fb.data as Omit<(typeof bookingRows)[number], "service_duration_minutes">[] | null) || []).map((b) => ({
          ...b,
          service_duration_minutes: null,
        }));
      }

      setFullName(profileRes.data?.full_name || t.common.proFallback);
      const photoList = (photosRes.data || []) as { id: string; url: string; caption: string | null; is_primary?: boolean }[];
      setPhotos(photoList);
      void (async () => {
        const entries = await Promise.all(
          photoList.map(async (p) => [p.id, await resolveStorageDisplayUrl("pro-photos", p.url)] as const),
        );
        const map: Record<string, string> = {};
        for (const [id, url] of entries) {
          if (url) map[id] = url;
        }
        setResolvedPhotoUrls(map);
      })();
      const primaryOrFirstPhoto = photoList.find((p) => p.is_primary)?.url ?? photoList[0]?.url;
      setAvatarUrl(primaryOrFirstPhoto || profileRes.data?.avatar_url || null);
      setServices(servicesRows);
      setLicenses((licensesRes.data as { license_number: string; license_type: string; is_verified: boolean }[] | null) || []);
      setAvgRating(Number(ratingRes.data?.[0]?.avg_rating || 0));
      setReviewCount(Number(ratingRes.data?.[0]?.review_count || 0));
      setProBookings(bookingRows);
      setLoading(false);
    };
    fetch();
  }, [proId]);

  useEffect(() => {
    if (!proId || !pro?.id || pro.user_id === user?.id || viewRecordedRef.current) return;
    viewRecordedRef.current = true;
    supabase.from("pro_profile_views").insert({ pro_profile_id: proId }).then(() => {});
  }, [proId, pro?.id, pro?.user_id, user?.id]);

  useEffect(() => {
    if (!user || !proId) {
      setIsProSaved(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("client_saved_pros")
        .select("pro_profile_id")
        .eq("user_id", user.id)
        .eq("pro_profile_id", proId)
        .maybeSingle();
      setIsProSaved(!!data);
    })();
  }, [user, proId]);

  const handleToggleSavePro = async () => {
    if (!proId) return;
    if (!user) {
      navigate("/auth?mode=login&redirect=" + encodeURIComponent(`/pros/${proId}`));
      return;
    }
    if (isProSaved) {
      const { error } = await supabase.from("client_saved_pros").delete().eq("user_id", user.id).eq("pro_profile_id", proId);
      if (error) {
        toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
        return;
      }
      setIsProSaved(false);
      toast({ title: t.dashboard?.savedProHeart ?? "Saved", description: t.dashboard?.savedProRemoved ?? "Removed from saved pros." });
    } else {
      const { error } = await supabase
        .from("client_saved_pros")
        .upsert({ user_id: user.id, pro_profile_id: proId }, { onConflict: "user_id,pro_profile_id" });
      if (error) {
        toast({ title: t.auth.toastError, description: error.message, variant: "destructive" });
        return;
      }
      setIsProSaved(true);
      toast({ title: t.dashboard?.savedProHeart ?? "Saved", description: t.dashboard?.savedProAdded ?? "Added to saved pros." });
    }
  };

  const { mainBio, entries: languageEntries } = useMemo(
    () => splitBioAndLanguages(pro?.bio ?? null, locale),
    [pro?.bio, locale]
  );

  const portfolioPhotos = useMemo(() => {
    const gallery = photos.filter((p) => !p.is_primary);
    return gallery.length > 0 ? gallery : photos;
  }, [photos]);

  if (loading) {
    return (
      <Layout>
        <div className="container py-20 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      </Layout>
    );
  }

  if (!pro) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Pro not found</h1>
          <Button asChild><Link to="/services">Browse Services</Link></Button>
        </div>
      </Layout>
    );
  }

  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase();
  const firstService = services[0];
  const category = firstService ? serviceCategories.find((c) => c.slug === firstService.category_slug) : null;
  const proFeatureTier = effectiveProTier(pro.subscription_tier, proBillingPlanId);
  const canAdvertiseAndBook = isPaidSubscriptionPlanId(proFeatureTier);
  const featuredLook = hasFeaturedPublicProfileLook(proFeatureTier);
  const pagePrimary = featuredLook ? pro.page_primary_color || "#1e3a5f" : "hsl(var(--primary))";
  const pageSecondary = featuredLook ? pro.page_secondary_color || "#0d9488" : "hsl(var(--secondary))";
  const pageAccent = featuredLook ? pro.page_accent_color || "#e0f2f1" : null;
  const pageBackground = featuredLook ? pro.page_background_color || "#f8fafc" : null;
  const sidebarPrimary = pagePrimary;
  const sidebarSecondary = pageSecondary;
  const sidebarGradient = `linear-gradient(145deg, ${sidebarPrimary} 0%, ${sidebarSecondary} 45%, ${sidebarPrimary} 100%)`;
  const customAccentHex = getAccentHex(pro.pro_accent_color);
  const actionColor = featuredLook ? pagePrimary : customAccentHex;
  const accentStyle = actionColor ? { color: actionColor } : undefined;
  const accentBgStyle = actionColor ? { backgroundColor: actionColor } : undefined;
  const accentBorderStyle = actionColor ? { borderColor: actionColor } : undefined;

  const brandPrimaryHex = featuredLook
    ? String(pro.page_primary_color || "#1e3a5f").trim()
    : customAccentHex || "#2563eb";
  const brandSecondaryHex =
    featuredLook && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(pageSecondary).trim())
      ? String(pageSecondary).trim()
      : null;
  const darkTones = isDarkMode ? buildProPageDarkTones(brandPrimaryHex, brandSecondaryHex) : null;
  const lightTones = !isDarkMode ? buildProPageLightTones(brandPrimaryHex, brandSecondaryHex) : null;

  const pageShellStyle =
    isDarkMode && darkTones
      ? { background: darkTones.shellGradient }
      : featuredLook && !isDarkMode
        ? (() => {
            const pHex = String(pagePrimary).trim();
            const sHex = String(pageSecondary).trim();
            const pOk = /^#([0-9a-fA-F]{6})$/.test(pHex);
            const sOk = /^#([0-9a-fA-F]{6})$/.test(sHex);
            if (!pOk) {
              return {
                background: `linear-gradient(180deg, ${pageBackground} 0%, ${pageBackground} 58%, ${pagePrimary}22 100%)`,
              };
            }
            if (sOk) {
              return {
                background: `linear-gradient(180deg, ${pageBackground} 0%, ${pageBackground} 22%, ${pHex}14 48%, ${pHex}26 76%, ${sHex}2a 100%)`,
              };
            }
            return {
              background: `linear-gradient(180deg, ${pageBackground} 0%, ${pageBackground} 28%, ${pHex}1a 52%, ${pHex}2e 100%)`,
            };
          })()
        : !isDarkMode && lightTones
          ? { background: lightTones.shellGradient }
          : undefined;

  const featuredHeaderStyle = featuredLook
    ? {
        ["--profile-primary" as string]: pagePrimary,
        ["--profile-secondary" as string]: pageSecondary,
      }
    : isDarkMode && darkTones
      ? { backgroundColor: darkTones.headerStrip }
      : !isDarkMode && lightTones
        ? { backgroundColor: lightTones.headerStrip }
        : { backgroundColor: "#F3F4F6" };
  const serviceTags = (pro.service_tags || []).filter(Boolean);
  const showBookingAi = hasBookingAssistantAI(proFeatureTier);

  const pageInner = (
        <div
          className={cn(
            "min-h-screen relative text-foreground",
            !isDarkMode && !pageShellStyle && "bg-gradient-page"
          )}
          ref={pageContentRef}
          style={pageShellStyle}
        >
          <div className="relative z-10 w-full py-0 md:container md:py-10">
          {/* Profile card: pops above tinted shell (light shadow/ring; dark shadow) */}
          <div
            className={cn(
              "mb-0 overflow-hidden border-y border-border bg-white md:mb-14 md:rounded-2xl md:border",
              !isDarkMode && lightTones
                ? "border-slate-300/80 shadow-[0_4px_6px_-1px_rgba(15,23,42,0.06),0_20px_50px_-14px_rgba(15,23,42,0.16)] ring-1 ring-slate-900/[0.07]"
                : "shadow-[0_4px_20px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]",
              "dark:border-white/10 dark:bg-transparent dark:shadow-[0_4px_28px_rgba(0,0,0,0.45)]"
            )}
            style={
              isDarkMode && darkTones
                ? { backgroundColor: darkTones.cardSurface }
                : !isDarkMode && lightTones
                  ? { backgroundColor: lightTones.cardSurface }
                  : undefined
            }
          >
          {/* Header: very subtle neutral background (custom color from dashboard), soft shadow */}
          <header
            className={cn(
              "relative min-h-[180px] overflow-hidden md:rounded-t-2xl",
              featuredLook && "bg-[linear-gradient(150deg,var(--profile-primary)_0%,var(--profile-primary)_72%,var(--profile-secondary)_100%)] md:bg-[linear-gradient(145deg,var(--profile-primary)_0%,var(--profile-secondary)_62%,var(--profile-primary)_100%)]"
            )}
            style={featuredHeaderStyle}
          >
            {featuredLook && pro.banner_image_url && (
              <div className="absolute inset-0 z-[1]" aria-hidden>
                <img src={pro.banner_image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/35" aria-hidden />
              </div>
            )}
            <div className="relative z-10 px-6 py-8 md:px-8 md:py-10">
            {featuredLook && pro.page_header_text && (
              <div className="prose prose-lg md:prose-xl max-w-none mb-8 text-white prose-headings:text-white prose-p:text-white/85" dangerouslySetInnerHTML={{ __html: pro.page_header_text }} />
            )}
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="w-20 h-20 rounded-xl border-2 shrink-0" style={featuredLook ? { borderColor: "rgba(255,255,255,0.55)" } : actionColor ? { borderColor: actionColor } : { borderColor: "#E5E7EB" }}>
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-xl font-bold rounded-xl text-white" style={accentBgStyle || { backgroundColor: "hsl(var(--primary))" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                "flex-1 min-w-0",
                featuredLook
                  ? "text-white [&_.text-muted-foreground]:text-white/80"
                  : "text-neutral-950 dark:text-zinc-100 [&_.text-muted-foreground]:text-neutral-700 dark:[&_.text-muted-foreground]:text-zinc-400"
              )}>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className={cn("font-heading text-2xl md:text-3xl font-bold", featuredLook ? "text-white" : "text-neutral-950 dark:text-zinc-50")}>{pro.business_name}</h1>
                  {pro.is_verified && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-white"
                      style={featuredLook ? { backgroundColor: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.35)" } : accentBgStyle || { backgroundColor: "hsl(var(--primary))" }}
                    >
                      <ShieldCheck size={12} /> {t.common?.verified ?? "Verified"}
                    </span>
                  )}
                </div>
                {serviceTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {serviceTags.map((tag) => (
                      <span
                        key={tag}
                        className={cn(
                          "text-xs px-2.5 py-0.5 rounded-full border font-medium",
                          featuredLook ? "bg-white/15 text-white border-white/30" : "bg-neutral-100 text-neutral-950 border-neutral-300"
                        )}
                        style={!featuredLook && actionColor ? { borderColor: actionColor, color: actionColor } : undefined}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className={cn("mt-1", featuredLook ? "text-white/85" : "text-neutral-800 dark:text-zinc-300")}>{fullName}</p>
                <div className={cn("flex items-center gap-3 mt-2 flex-wrap", featuredLook ? "text-white" : "text-neutral-900 dark:text-zinc-200")}>
                  <span className="inline-flex rounded-md border-2 border-amber-500 bg-white px-1.5 py-0.5 shadow-sm [&_svg]:text-amber-500">
                    <StarRating rating={avgRating} size={16} emptyStarsLightSurface />
                  </span>
                  <span className={cn("text-sm", featuredLook ? "text-white/85" : "text-neutral-800 dark:text-zinc-400")}>
                    ({reviewCount} {reviewCount === 1 ? (t.common?.review ?? "review") : (t.common?.reviews ?? "reviews")})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "gap-1.5 border-2",
                      featuredLook
                        ? "border-white/45 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                        : "border-neutral-900 bg-white text-neutral-950 hover:bg-neutral-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    )}
                    onClick={handleShare}
                  >
                    <Share2 size={16} /> {t.common?.share ?? "Share"}
                  </Button>
                  {user?.id !== pro.user_id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        "gap-1.5 border-2",
                        featuredLook
                          ? "border-white/45 bg-white/15 text-white hover:bg-white/25 hover:text-white"
                          : "border-neutral-900 bg-white text-neutral-950 hover:bg-neutral-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      )}
                      onClick={handleToggleSavePro}
                      aria-pressed={isProSaved}
                    >
                      <Heart
                        size={16}
                        className={cn(isProSaved ? "fill-red-500 text-red-500" : featuredLook ? "text-white" : "text-neutral-800 dark:text-zinc-200")}
                        strokeWidth={isProSaved ? 0 : 2}
                      />
                      {isProSaved ? (t.dashboard?.savedProHeart ?? "Saved") : (t.dashboard?.saveProHeart ?? "Save")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-col gap-6 px-4 pt-2 pb-1 md:px-8">
            <div className="border-b border-border">
              <div className="flex gap-1">
                {(["about", "services", "credentials"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                      activeTab === tab
                        ? "bg-muted border border-b-0 border-border text-foreground -mb-px"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "about" && (t.profile?.about ?? "About")}
                    {tab === "services" && (t.profile?.services ?? "Services")}
                    {tab === "credentials" && (t.profile?.credentials ?? "Credentials")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-4 pb-8 md:gap-14 md:px-8 md:pb-10 lg:grid-cols-3">
            {/* Main content: tab panels */}
            <div className="lg:col-span-2 space-y-10 md:space-y-14">
              {activeTab === "about" && (
                <>
                  {mainBio ? (
                    <section className="pt-2">
                      <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{t.profile?.about ?? "About"}</h2>
                      <p className="text-muted-foreground leading-relaxed">{mainBio}</p>
                    </section>
                  ) : null}
                  <section>
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-3">{t.profile?.overview ?? "Overview"}</h2>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {pro.years_experience > 0 && (
                        <li className="flex items-center gap-2">
                          <Briefcase size={16} className="shrink-0" style={accentStyle} />
                          {pro.years_experience} {t.common?.yearsExp ?? "years experience"}
                        </li>
                      )}
                    </ul>
                  </section>
                  <section className="pt-2">
                    <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{t.profile?.languages ?? "Languages"}</h2>
                    <p className="text-sm text-muted-foreground mb-4">{t.profile?.languagesIntro}</p>
                    {languageEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t.profile?.languagesEmpty}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {languageEntries.map((e, i) => {
                          const levelLabel =
                            e.level === "fluent"
                              ? t.createPro.languageLevelFluent
                              : e.level === "conversational"
                                ? t.createPro.languageLevelConversational
                                : e.level === "basic"
                                  ? t.createPro.languageLevelBasic
                                  : "";
                          return (
                            <span
                              key={`${e.languageLabel}-${i}`}
                              className="inline-flex flex-col items-start gap-0.5 rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-950 shadow-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-50"
                            >
                              <span>{e.languageLabel}</span>
                              {levelLabel ? (
                                <span className="text-xs font-normal text-neutral-600 dark:text-neutral-400">{levelLabel}</span>
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </section>
                  <section id="reviews">
                    <ReviewSection proProfileId={pro.id} proUserId={pro.user_id} scrollToId="reviews" />
                  </section>
                </>
              )}

              {activeTab === "services" && (
                <>
                  {services.length > 0 && (
                    <section>
                      <h2 className="font-heading text-lg font-semibold text-foreground mb-3">{t.profile?.servicesOffered ?? "Services offered"}</h2>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {services.map((svc) => (
                          <span
                            key={svc.service_slug}
                            className={cn(
                              "px-3 py-1.5 rounded-full border text-sm font-medium",
                              featuredLook && pageAccent
                                ? isLightHexColor(pageAccent)
                                  ? "text-neutral-950"
                                  : "text-white"
                                : "bg-[#F7F7F7] dark:bg-muted text-foreground",
                            )}
                            style={featuredLook && pageAccent ? { backgroundColor: pageAccent, borderColor: pagePrimary } : accentBorderStyle}
                          >
                            {serviceLineLabel(svc)}
                          </span>
                        ))}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-muted-foreground">
                        {services.map((svc) => (
                          <div key={svc.service_slug} className="flex items-start gap-2">
                            <Check size={16} className="shrink-0 mt-0.5" style={accentStyle} />
                            <div>
                              <span className="font-medium text-foreground">{serviceLineLabel(svc)}</span>
                              {svc.description && <p className="text-muted-foreground mt-0.5">{svc.description}</p>}
                              {(svc.custom_price_min || svc.custom_price_max) && (
                                <p className={`font-medium mt-1 ${!actionColor ? "text-primary" : ""}`} style={accentStyle}>
                                  {svc.custom_price_min && svc.custom_price_max
                                    ? `$${Number(svc.custom_price_min)} – $${Number(svc.custom_price_max)}`
                                    : svc.custom_price_min ? `From $${Number(svc.custom_price_min)}` : `Up to $${Number(svc.custom_price_max)}`}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {portfolioPhotos.length > 0 && (
                    <section>
                      <h2 className="font-heading text-lg font-semibold text-foreground mb-3">Portfolio</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {portfolioPhotos.map((photo) => {
                          const displayUrl = resolvedPhotoUrls[photo.id] ?? photo.url;
                          return (
                            <button
                              key={photo.id}
                              type="button"
                              className="relative rounded-lg overflow-hidden border border-border aspect-square p-0 block w-full text-left cursor-pointer hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                              onClick={() => setLightboxPhoto(displayUrl)}
                              aria-label={photo.caption || t.common.workPhoto}
                            >
                              <StorageDisplayImage
                                bucket="pro-photos"
                                url={photo.url}
                                alt={photo.caption || t.common.workPhoto}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              {photo.caption && (
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-2">
                                  <p className="text-xs text-white">{photo.caption}</p>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}

              {activeTab === "credentials" && (
                <>
                  {licenses.length > 0 && (
                    <section>
                      <h2 className="font-heading text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Info size={18} /> {t.profile?.credentials ?? "Credentials"}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {licenses.map((lic) => (
                          <LicenseBadge
                            key={lic.license_number}
                            licenseNumber={lic.license_number}
                            licenseType={lic.license_type}
                            isVerified={lic.is_verified}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {fullName} · <button type="button" className="text-primary hover:underline">{t.profile?.viewCredentialDetails ?? "View credential details"}</button>
                      </p>
                    </section>
                  )}
                  <section id="reviews" className="lg:hidden">
                    <ReviewSection proProfileId={pro.id} proUserId={pro.user_id} scrollToId="reviews" />
                  </section>
                </>
              )}

              <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-2 bg-black/90 border-0 overflow-hidden [&>button:last-of-type]:hidden">
                  <DialogDescription className="sr-only">
                    {t.common?.workPhoto ?? "Work photo"}
                  </DialogDescription>
                  {lightboxPhoto && (
                    <div className="relative inline-block max-w-full max-h-[90vh]">
                      <button
                        type="button"
                        onClick={() => setLightboxPhoto(null)}
                        className="absolute right-2 top-2 z-10 p-1 bg-transparent border-0 opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 rounded-sm"
                        style={{ color: lightboxImageDark ? "#fff" : "#000" }}
                        aria-label="Close"
                      >
                        <X className="h-8 w-8" strokeWidth={2.5} />
                      </button>
                      <img src={lightboxPhoto} alt="" className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded block" />
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Sidebar: booking card elevated; guarantee tinted / dark in dark mode; calendar card */}
            <aside className={cn("lg:sticky lg:top-24 space-y-5 self-start", activeTab === "credentials" && "hidden lg:block")}>
              <div
                className="rounded-xl p-6 bg-white shadow-md border border-border dark:border-white/10 dark:bg-transparent"
                style={
                  isDarkMode && darkTones
                    ? { backgroundColor: darkTones.sidebarSurface }
                    : !isDarkMode && lightTones
                      ? { backgroundColor: lightTones.sidebarSurface }
                      : undefined
                }
              >
                {(() => {
                  const servicePrices = services
                    .map((s) => s.custom_price_min ?? s.custom_price_max ?? null)
                    .filter((p): p is number => p != null && Number(p) > 0);
                  const minServicePrice = servicePrices.length > 0 ? Math.min(...servicePrices) : null;
                  const showServicePrice = minServicePrice != null;
                  const showProPrice = (pro.price_min || pro.price_max) && !showServicePrice;
                  if (showServicePrice) {
                    return (
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-foreground">
                          {t.profile?.startingPrice ?? "Starting price"}: ${Number(minServicePrice).toLocaleString()}
                        </p>
                        {services.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllServicesModalOpen(true)}
                            className="text-sm font-medium mt-1 underline hover:no-underline text-muted-foreground hover:text-foreground focus:outline-none"
                          >
                            {t.profile?.clickHereForAllServices ?? "Click here for all services"}
                          </button>
                        )}
                      </div>
                    );
                  }
                  if (showProPrice && services.length === 0) {
                    return (
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-foreground">
                          {t.profile?.startingPrice ?? "Starting price"}: {pro.price_min != null ? `$${Number(pro.price_min).toLocaleString()}` : pro.price_max != null ? `$${Number(pro.price_max).toLocaleString()}` : "-"}
                        </p>
                      </div>
                    );
                  }
                  if (services.length > 0) {
                    return (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => setAllServicesModalOpen(true)}
                          className="text-sm font-medium underline hover:no-underline text-muted-foreground hover:text-foreground focus:outline-none"
                        >
                          {t.profile?.clickHereForAllServices ?? "Click here for all services"}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
                {adminCannotBook ? (
                  <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
                    {locale === "fr"
                      ? "Les comptes administrateur ne peuvent pas réserver de services. Utilisez le tableau de bord Admin pour gérer les comptes."
                      : "Admin accounts cannot book services. Use the Admin dashboard to manage accounts."}
                  </p>
                ) : !canAdvertiseAndBook ? (
                  <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-muted-foreground">
                    {locale === "fr"
                      ? "Ce professionnel n’est pas encore disponible à la réservation (forfait payant requis). Les profils sans forfait actif n’apparaissent pas dans la recherche."
                      : "This professional is not available for booking yet (an active paid plan is required). Profiles without a paid plan do not appear in search."}
                  </p>
                ) : featuredLook ? (
                <StarBorder as="div" color="rgba(0,0,0,0.08)" speed="4s" thickness={2} className="w-full mb-3" innerClassName="!bg-transparent !border-0 !p-0">
                  <Button
                    className="w-full min-h-12 py-4 text-base font-semibold gap-2 rounded-lg border-2 text-white hover:opacity-90"
                    style={{ backgroundColor: actionColor || "hsl(var(--primary))", borderColor: actionColor || "hsl(var(--primary))" }}
                    onClick={() => {
                      if (services.length > 1) {
                        setAllServicesModalOpen(true);
                      } else {
                        setSelectedBookingService(services[0] ?? null);
                        setBookingDialogOpen(true);
                      }
                    }}
                  >
                    <CalendarCheck size={20} /> {t.terms.requestBooking}
                  </Button>
                </StarBorder>
                ) : (
                  <Button
                    className="w-full min-h-12 py-4 text-base font-semibold gap-2 rounded-lg border-2 text-white hover:opacity-90 mb-3"
                    style={{ backgroundColor: actionColor || "hsl(var(--primary))", borderColor: actionColor || "hsl(var(--primary))" }}
                    onClick={() => {
                      if (services.length > 1) {
                        setAllServicesModalOpen(true);
                      } else {
                        setSelectedBookingService(services[0] ?? null);
                        setBookingDialogOpen(true);
                      }
                    }}
                  >
                    <CalendarCheck size={20} /> {t.terms.requestBooking}
                  </Button>
                )}
                <div className="space-y-1.5 text-xs text-muted-foreground mt-3">
                  <p className="flex items-center gap-2">✔ {t.terms?.securePayment ?? "Secure payment"}</p>
                  <p className="flex items-center gap-2">✔ {t.guarantee?.title ?? "Booking protection"}</p>
                  <p className="flex items-center gap-2">✔ {t.common?.verified ?? "Verified professional"}</p>
                </div>
              </div>
              <div
                className={cn(
                  "hidden rounded-xl p-6 border shadow-sm lg:block text-foreground",
                  "dark:border-white/10 dark:bg-transparent dark:shadow-md"
                )}
                style={
                  isDarkMode && darkTones
                    ? { backgroundColor: darkTones.guaranteePanel, borderColor: darkTones.guaranteeBorder }
                    : !isDarkMode && lightTones
                      ? { backgroundColor: lightTones.guaranteePanel, borderColor: lightTones.guaranteeBorder }
                      : undefined
                }
              >
                <h3 className="font-semibold text-sm mb-2 text-slate-700 dark:text-zinc-300">
                  {t.guarantee?.title ?? "Booking Guarantee"}
                </h3>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                  {t.guarantee?.rebookingDesc ?? "If something goes wrong, we'll help you rebook at no extra cost."}
                </p>
                <Link
                  to="/terms"
                  className="text-xs font-medium hover:underline mt-2 inline-block text-sky-800/90 hover:text-sky-900 dark:text-sky-200 dark:hover:text-sky-100"
                >
                  {t.common?.learnMore ?? "Learn more"}
                </Link>
              </div>
              <div
                className="hidden rounded-xl p-6 bg-white shadow-md border border-border dark:border-white/10 dark:bg-transparent lg:block"
                style={
                  isDarkMode && darkTones
                    ? { backgroundColor: darkTones.sidebarSurface }
                    : !isDarkMode && lightTones
                      ? { backgroundColor: lightTones.sidebarSurface }
                      : undefined
                }
              >
                <h3 className="font-semibold text-foreground text-sm mb-2">{t.profile?.availability ?? "Availability"}</h3>
                <p className="text-xs text-muted-foreground mb-2">{t.profile?.clickDateToBook ?? "Click an available date to request a booking."}</p>
                <AvailabilityCalendar
                  availability={pro.availability}
                  busyDates={busyDatesList}
                  unavailableDates={pro.unavailable_dates ?? {}}
                  availableDateOverrides={pro.available_date_overrides ?? []}
                  onDayClick={handleCalendarDayClick}
                  availableDayColor={sidebarPrimary}
                  arrowsWhite
                  minBookingDate={todayStr}
                />
              </div>
              <RecommendationSidebar
                currentProId={pro.id}
                serviceSlug={firstService?.service_slug}
                categorySlug={firstService?.category_slug}
              />
            </aside>
          </div>
          </div>
        </div>

        <Dialog open={allServicesModalOpen} onOpenChange={setAllServicesModalOpen}>
          <DialogContent className="max-w-md bg-white dark:bg-card text-foreground border border-border shadow-xl">
            <DialogHeader>
              <DialogTitle>{t.profile?.allServicesTitle ?? "All services"}</DialogTitle>
              <DialogDescription className="sr-only">
                {t.profile?.allServicesTitle ?? "All services"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
              {services.map((svc, index) => {
                const price = svc.custom_price_min ?? svc.custom_price_max ?? null;
                const priceStr = price != null ? `$${Number(price)}` : "";
                const shortName = serviceLineLabel(svc);
                return (
                  <div
                    key={`${svc.category_slug}-${svc.service_slug}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{shortName}</p>
                      {priceStr && <p className="text-sm text-muted-foreground">{priceStr}</p>}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingService(svc);
                        setAllServicesModalOpen(false);
                        setBookingDialogOpen(true);
                      }}
                      style={actionColor ? { backgroundColor: actionColor, borderColor: actionColor } : undefined}
                      className={!actionColor ? "" : "text-white border-2"}
                    >
                      {t.profile?.bookThisService ?? "Book"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={bookingDialogOpen} onOpenChange={(open) => {
              setBookingDialogOpen(open);
              if (open) {
                setSelectedBookingService(prev => prev ?? services[0] ?? null);
              } else {
                setBookingTermsAccepted(false);
                setBookingCancelPolicyAccepted(false);
                setBookingCancelPolicyDetailsOpen(false);
                setBookingStep(1);
                setBookingPhotoWithIdFile(null);
                setSelectedBookingDate(null);
                setSelectedBookingTime(null);
                setSelectedBookingService(null);
                setBookingClientRenewAnnually(false);
                setBookingLocationChoice(null);
                setTravelToClientPreview(null);
                setWorkspaceVisitPreview(null);
              }
            }}>
              <DialogContent
                className={
                  bookingStep === 4
                    ? "max-w-lg max-h-[90vh] overflow-y-auto flex flex-col bg-transparent border-0 shadow-none p-2 sm:p-4"
                    : "max-w-lg max-h-[90vh] overflow-y-auto flex flex-col bg-gray-900 text-white [&_.text-foreground]:text-white [&_.text-muted-foreground]:text-white/90"
                }
              >
                {bookingStep !== 4 && (
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {bookingStep === 1 && (t.terms.bookingSelectDate ?? "Select date & confirm")}
                    {bookingStep === 2 && (t.terms.bookingStepVerification ?? "Verification")}
                    {bookingStep === 3 && (t.terms.bookingStepVerification ?? "Verification")}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    {bookingStep === 1 &&
                      (t.terms.bookingSelectDate ?? "Select date and confirm your booking request.")}
                    {bookingStep === 2 &&
                      (t.terms.bookingStepVerification ?? "Upload a photo of yourself with ID.")}
                    {bookingStep === 3 && (t.terms.bookingStepVerification ?? "Verification")}
                  </DialogDescription>
                </DialogHeader>
                )}

                {bookingStep === 1 && (
                  <>
                    {services.length >= 1 && (
                      <div className="space-y-2 mb-4">
                        <Label className="text-white">{t.profile?.servicesOffered ?? "Service"}</Label>
                        <div className="space-y-2">
                          {services.map((svc, index) => {
                            const price = svc.custom_price_min ?? svc.custom_price_max ?? 0;
                            const priceStr = price ? `$${Number(price)}` : "";
                            const isSelected = selectedBookingService === svc;
                            return (
                              <button
                                key={`${svc.category_slug}-${svc.service_slug}-${index}`}
                                type="button"
                                onClick={() => setSelectedBookingService(svc)}
                                className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-colors ${isSelected ? "border-white bg-white/20 text-white" : "border-gray-600 bg-gray-800/50 text-white/90 hover:bg-gray-700/50"}`}
                              >
                                <span className="font-medium">{serviceLineLabel(svc)}</span>
                                {priceStr && <span className="ml-2 text-white/80"> -  {priceStr}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="booking-date" className="text-white">{t.terms.bookingPreferredDate ?? "Preferred appointment date"}</Label>
                      <Input
                        id="booking-date"
                        type="date"
                        value={selectedBookingDate ?? ""}
                        onChange={(e) => {
                          setSelectedBookingDate(e.target.value || null);
                          setSelectedBookingTime(null);
                        }}
                        min={todayStr}
                        className="w-full bg-gray-800 border-gray-600 text-white"
                      />
                      <p className="text-xs text-white/80">{t.terms.bookingDateHint ?? "Pick a date from the calendar on the right, or choose above. Then accept the terms to continue."}</p>

                      {selectedBookingDate && scheduleClientNote ? (
                        <div className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-xs text-amber-50">
                          <span className="font-semibold block mb-0.5 text-amber-100">
                            {t.terms.bookingProScheduleNoteTitle ?? "Note from the professional"}
                          </span>
                          <span className="whitespace-pre-wrap text-white/95">{scheduleClientNote}</span>
                        </div>
                      ) : null}

                      {selectedBookingDate && (
                        <div className="space-y-2">
                          <Label htmlFor="booking-time" className="text-white">
                            Start time *
                          </Label>
                          <select
                            id="booking-time"
                            value={selectedBookingTime ?? ""}
                            onChange={(e) => setSelectedBookingTime(e.target.value || null)}
                            className="w-full rounded-md bg-gray-800 border border-gray-600 text-white px-3 py-2"
                          >
                            <option value="" disabled>
                              Select a start time
                            </option>
                            {bookingTimeOptions.length > 0 ? (
                              bookingTimeOptions.map((time) => (
                                <option key={time} value={time}>
                                  {time}
                                </option>
                              ))
                            ) : (
                              <option value="" disabled>
                                No available times
                              </option>
                            )}
                          </select>
                          <p className="text-xs text-white/80">
                            Choose the hour when the pro should start.
                          </p>
                        </div>
                      )}
                    </div>
                    {pro && hasGrowthServiceExtras(proFeatureTier) && selectedBookingService?.auto_reply_message?.trim() && (
                      <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/95 mt-2">
                        <span className="font-semibold block mb-0.5">{t.terms.bookingAutoReplyTitle}</span>
                        {selectedBookingService.auto_reply_message.trim()}
                      </div>
                    )}
                    {pro &&
                      hasGrowthServiceExtras(proFeatureTier) &&
                      selectedBookingService?.renewal_interval_months != null && (
                        <div
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs mt-2 space-y-2",
                            isDarkMode
                              ? "border-white/20 bg-white/5 text-white/90"
                              : "border-slate-200 bg-white text-slate-800 shadow-sm"
                          )}
                        >
                          <p className={cn(isDarkMode ? "text-white/90" : "text-slate-700")}>
                            {(t.terms.bookingRenewalOffer ?? "").replace(
                              "{{months}}",
                              String(selectedBookingService.renewal_interval_months)
                            )}
                          </p>
                          <label
                            className={cn(
                              "flex items-center gap-2 cursor-pointer rounded-md border px-2 py-1.5 transition-colors",
                              isDarkMode
                                ? !bookingClientRenewAnnually
                                  ? "border-white/50 bg-white/15 text-white"
                                  : "border-transparent text-white/75 hover:bg-white/10"
                                : !bookingClientRenewAnnually
                                  ? "border-slate-900 bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/20"
                                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <input
                              type="radio"
                              name="renewal-mode"
                              checked={!bookingClientRenewAnnually}
                              onChange={() => setBookingClientRenewAnnually(false)}
                              className={cn(isDarkMode ? "accent-white" : "accent-slate-900")}
                            />
                            {t.terms.bookingRenewalOneTime}
                          </label>
                          <label
                            className={cn(
                              "flex items-center gap-2 cursor-pointer rounded-md border px-2 py-1.5 transition-colors",
                              isDarkMode
                                ? bookingClientRenewAnnually
                                  ? "border-white/50 bg-white/15 text-white"
                                  : "border-transparent text-white/75 hover:bg-white/10"
                                : bookingClientRenewAnnually
                                  ? "border-slate-900 bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/20"
                                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            <input
                              type="radio"
                              name="renewal-mode"
                              checked={bookingClientRenewAnnually}
                              onChange={() => setBookingClientRenewAnnually(true)}
                              className={cn(isDarkMode ? "accent-white" : "accent-slate-900")}
                            />
                            {t.terms.bookingRenewalOptIn}
                          </label>
                        </div>
                      )}
                    {selectedBookingService && bookingServiceMode === "both" ? (
                      <div className="space-y-2 mt-3 rounded-lg border border-white/20 bg-white/5 p-3">
                        <p className="text-sm font-medium text-white">{t.terms.bookingWhereService ?? "Where will the service take place?"}</p>
                        <label className="flex items-center gap-2 text-sm text-white/90 cursor-pointer">
                          <input
                            type="radio"
                            name="booking-loc"
                            checked={resolvedBookingChoice === "workspace"}
                            onChange={() => setBookingLocationChoice("workspace")}
                            className="accent-white"
                          />
                          {t.terms.bookingAtProWorkspace ?? "At the professional's workspace"}
                        </label>
                        <label
                          className={cn(
                            "flex items-center gap-2 text-sm",
                            clientOutsideTravelZone && proLocationOffers.offersWorkspace
                              ? "text-white/45 cursor-not-allowed"
                              : "text-white/90 cursor-pointer",
                          )}
                        >
                          <input
                            type="radio"
                            name="booking-loc"
                            checked={resolvedBookingChoice === "travel"}
                            disabled={clientOutsideTravelZone && proLocationOffers.offersWorkspace}
                            onChange={() => {
                              if (clientOutsideTravelZone && proLocationOffers.offersWorkspace) return;
                              setBookingLocationChoice("travel");
                            }}
                            className="accent-white disabled:opacity-50"
                          />
                          {t.terms.bookingProComesToYou ?? "Professional comes to me"}
                        </label>
                        {clientOutsideTravelZone && proLocationOffers.offersWorkspace ? (
                          <p className="text-xs text-amber-100 rounded-md border border-amber-400/50 bg-amber-950/50 px-3 py-2.5 leading-relaxed">
                            {(t.terms.bookingOutsideOfferWorkspace ?? "")
                              .replace("{{km}}", String(Math.round(travelToClientPreview?.distanceKm ?? 0)))
                              .replace("{{radius}}", String(pro?.service_radius_km ?? 50))
                              .replace(
                                "{{duration}}",
                                travelToClientPreview
                                  ? formatDriveDurationLabel(travelToClientPreview.durationMinutes)
                                  : "-",
                              )}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {clientOutsideTravelZone && bookingServiceMode === "travel" && !proLocationOffers.offersWorkspace ? (
                      <p className="mt-3 text-xs text-amber-100 rounded-md border border-amber-400/50 bg-amber-950/50 px-3 py-2.5 leading-relaxed">
                        {(t.terms.bookingOutsideNoWorkspace ?? "")
                          .replace("{{km}}", String(Math.round(travelToClientPreview?.distanceKm ?? 0)))
                          .replace("{{radius}}", String(pro?.service_radius_km ?? 50))
                          .replace(
                            "{{duration}}",
                            travelToClientPreview
                              ? formatDriveDurationLabel(travelToClientPreview.durationMinutes)
                              : "-",
                          )}
                      </p>
                    ) : null}
                    {selectedBookingService &&
                    !clientOutsideTravelZone &&
                    (bookingServiceMode === "workspace" ||
                      bookingServiceMode === "travel" ||
                      bookingServiceMode === "both") ? (
                      <div className="mt-3 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs text-white/90">
                        {bookingDistanceLoading ? (
                          <span>{t.terms.bookingDistanceCalculating ?? "Calculating distance…"}</span>
                        ) : displayedDistancePreview ? (
                          <span>
                            {(t.terms.bookingDistancePreview ?? "~{{km}} km · ~{{duration}} by car")
                              .replace("{{km}}", String(Math.round(displayedDistancePreview.distanceKm)))
                              .replace(
                                "{{duration}}",
                                formatDriveDurationLabel(displayedDistancePreview.durationMinutes),
                              )}
                          </span>
                        ) : getBrowsePostalLocation() || clientProfileAddressRaw ? (
                          <span>{t.terms.bookingDistanceUnavailable ?? "Distance estimate unavailable."}</span>
                        ) : (
                          <span>
                            {t.terms.bookingDistanceNeedPostal ??
                              t.terms.bookingDistanceNeedAddress ??
                              "Enter your postal code on Services (or add your address in My account) to see distance."}
                          </span>
                        )}
                      </div>
                    ) : null}
                    <p className="text-sm text-white/80 mt-4">{t.terms.bookingProAcceptPending ?? "The professional must accept your request before the booking is confirmed."}</p>
                    <p className="text-xs text-white/65 mt-1">{t.terms.bookingConfirmMessage}</p>
                    {(() => {
                      const priceCents = Math.round(
                        Number(
                          selectedBookingService?.custom_price_min ??
                            selectedBookingService?.custom_price_max ??
                            pro?.price_min ??
                            0,
                        ) * 100,
                      );
                      const fromService = selectedBookingService
                        ? resolveServiceCancelPolicy(selectedBookingService)
                        : null;
                      const resolved: ResolvedCancelPolicy = fromService ?? {
                        policy: normalizeBookingCancelPolicy(pro?.booking_cancel_policy),
                        feeType: "percent",
                        feePercent: normalizeBookingCancelFeePercent(pro?.booking_cancel_fee_percent),
                        feeCents: 0,
                      };
                      const copy = formatResolvedCancelPolicyText(
                        resolved,
                        locale === "fr" ? "fr" : "en",
                        priceCents > 0 ? priceCents : null,
                      );
                      return (
                        <div
                          className="mt-4 rounded-lg border-2 border-amber-500/70 bg-amber-500/15 p-4 space-y-3"
                          role="region"
                          aria-label={copy.title}
                        >
                          <p className="text-sm font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                            {locale === "fr" ? "Politique d’annulation (obligatoire)" : "Cancellation policy (required)"}
                          </p>
                          <p className="text-base font-semibold text-foreground">{copy.short}</p>
                          {resolved.policy === "late_fee" ? (
                            <p className="text-sm text-foreground/90">
                              {locale === "fr"
                                ? "Annulation moins de 24 h avant le début du service = frais ci-dessus."
                                : "Cancel less than 24 hours before start = the fee above applies."}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm font-medium text-amber-950/90 dark:text-amber-100/90 hover:underline"
                            aria-expanded={bookingCancelPolicyDetailsOpen}
                            onClick={() => setBookingCancelPolicyDetailsOpen((o) => !o)}
                          >
                            <span>
                              {bookingCancelPolicyDetailsOpen
                                ? locale === "fr"
                                  ? "Masquer les détails"
                                  : "Hide details"
                                : locale === "fr"
                                  ? "Voir les détails"
                                  : "View details"}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`shrink-0 transition-transform ${bookingCancelPolicyDetailsOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {bookingCancelPolicyDetailsOpen ? (
                            <p className="text-sm text-foreground/90 leading-relaxed border-t border-amber-500/30 pt-3">
                              {copy.body}
                            </p>
                          ) : null}
                          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-amber-600"
                              checked={bookingCancelPolicyAccepted}
                              onChange={(e) => setBookingCancelPolicyAccepted(e.target.checked)}
                            />
                            <span>
                              {locale === "fr"
                                ? "J’ai lu et j’accepte cette politique d’annulation pour cette réservation."
                                : "I have read and accept this cancellation policy for this booking."}
                            </span>
                          </label>
                        </div>
                      );
                    })()}
                    <TermsAcceptance
                      variant="booking"
                      accepted={bookingTermsAccepted}
                      onAcceptedChange={setBookingTermsAccepted}
                      inDialog
                      submitLabel={t.terms.continueToVerification ?? "Continue"}
                      onSubmit={() => {
                        if (!bookingCancelPolicyAccepted) {
                          toast({
                            title: t.auth.toastError,
                            description:
                              locale === "fr"
                                ? "Veuillez cocher que vous acceptez la politique d’annulation."
                                : "Please confirm you accept the cancellation policy.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (travelToClientBlocked) {
                          toast({
                            title: t.auth.toastError,
                            description:
                              t.terms.bookingOutsideNoWorkspace ??
                              "You are outside this professional's service area. Choose at their workspace if available.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (services.length >= 1 && !selectedBookingService) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingSelectServiceFirst ?? "Please select a service first.", variant: "destructive" });
                          return;
                        }
                        if (!selectedBookingDate) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingSelectDateFirst ?? "Please select a date first.", variant: "destructive" });
                          return;
                        }
                        if (selectedBookingDate < todayStr) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingDateNotInPast ?? "You cannot book a date in the past.", variant: "destructive" });
                          return;
                        }
                        if (!selectedBookingTime) {
                          toast({ title: t.auth.toastError, description: "Please select a start time.", variant: "destructive" });
                          return;
                        }
                        setBookingStep(2);
                      }}
                    />
                  </>
                )}

                {bookingStep === 2 && (
                  <>
                    {selectedBookingService && (selectedBookingService.custom_price_min != null || selectedBookingService.custom_price_max != null) && (
                      <p className="text-sm text-white/90 mb-2">
                        {t.profile?.servicesOffered ?? "Service"}: <strong className="text-white">{serviceLineLabel(selectedBookingService)}</strong>
                        {" - "}
                        <strong className="text-white">
                          ${Number(selectedBookingService.custom_price_min ?? selectedBookingService.custom_price_max ?? 0)}
                        </strong>
                      </p>
                    )}
                        {selectedBookingDate && (
                      <p className="text-sm text-white/90 mb-3">
                        {t.terms.bookingForDate ?? "Booking for"}: <strong className="text-white">{new Date(selectedBookingDate + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" })}</strong>
                        {selectedBookingTime ? (
                          <>
                            {" "}
                            <span className="text-white/90">·</span>{" "}
                            <strong className="text-white">
                              {formatBookingTimeRange(selectedBookingTime, selectedBookingService?.duration_minutes ?? null) || selectedBookingTime}
                            </strong>
                          </>
                        ) : null}
                      </p>
                    )}
                    {user && showBookingAi && selectedBookingService && (
                      <BookingServiceAssistantPanel
                        enabled
                        locale={locale === "fr" ? "fr" : "en"}
                        proBusinessName={pro.business_name}
                        serviceName={serviceLineLabel(selectedBookingService)}
                        serviceDescription={selectedBookingService.description}
                        appointmentSummary={
                          selectedBookingDate
                            ? `${new Date(selectedBookingDate + "T12:00:00").toLocaleDateString(undefined, {
                                dateStyle: "long",
                              })}${
                                selectedBookingTime
                                  ? ` · ${formatBookingTimeRange(selectedBookingTime, selectedBookingService?.duration_minutes ?? null) || selectedBookingTime}`
                                  : ""
                              }`
                            : ""
                        }
                        messages={{
                          title: t.profile?.bookingAiTitle ?? "Ask about this service",
                          intro: t.profile?.bookingAiIntro ?? "",
                          placeholder: t.profile?.bookingAiPlaceholder ?? "",
                          thinking: t.support.aiThinking,
                          signIn: t.support.signInToUse,
                          noReply: t.support.noReply,
                          errorGeneric: t.support.errorGeneric,
                        }}
                      />
                    )}
                    <div className="space-y-4">
                    {clientBookingIdPath ? (
                      <div className="rounded-lg border border-emerald-400/50 bg-emerald-950/40 px-3 py-2.5 text-sm text-white/95 space-y-1">
                        <p className="font-semibold text-white">{t.terms.bookingPhotoWithIdOnFileTitle}</p>
                        <p className="text-xs text-white/85">{t.terms.bookingPhotoWithIdOnFileBody}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-100/95 rounded-lg border border-amber-400/40 bg-amber-950/35 px-3 py-2">
                        {t.terms.bookingPhotoWithIdOneTimeNotice}
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label className="text-white">
                        {clientBookingIdPath ? t.terms.bookingPhotoWithIdReplaceLabel : t.terms.bookingPhotoWithId}
                      </Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          e.target.value = "";
                          if (!file) {
                            setBookingPhotoWithIdFile(null);
                            return;
                          }
                          try {
                            assertClientBookingIdFile(file);
                            setBookingPhotoWithIdFile(file);
                          } catch (err) {
                            setBookingPhotoWithIdFile(null);
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
                        className="cursor-pointer bg-gray-800 border-gray-600 text-white"
                      />
                      <p className="text-xs text-white/80">{t.terms.bookingPhotoWithIdHint}</p>
                    </div>
                    <Button
                      type="button"
                      className="w-full gap-2"
                      onClick={() => {
                        if (selectedBookingDate && selectedBookingDate < todayStr) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingDateNotInPast ?? "You cannot book a date in the past.", variant: "destructive" });
                          return;
                        }
                          if (!selectedBookingTime) {
                            toast({ title: t.auth.toastError, description: "Please select a start time.", variant: "destructive" });
                            return;
                          }
                        if (!bookingPhotoWithIdFile && !clientBookingIdPath) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingFillVerification, variant: "destructive" });
                          return;
                        }
                        setBookingStep(4);
                      }}
                    >
                      {t.terms.bookingContinueToConfirm ?? "Continue"} <ChevronRight size={16} />
                    </Button>
                  </div>
                  </>
                )}

                {bookingStep === 4 && pro && (
                  <>
                    {user ? (
                      <>
                        {!clientInvoiceAddress ? (
                          <div className="rounded-lg border border-amber-400/60 bg-amber-950/50 px-3 py-2 text-xs text-white/95 mb-3">
                            <p>{t.terms.bookingAddressInvoiceHint}</p>
                            <Link to="/dashboard?tab=account" className="inline-block mt-1 font-semibold underline text-white">
                              {locale === "fr" ? "Ouvrir Mon compte" : "Open My account"}
                            </Link>
                          </div>
                        ) : null}
                      <BookingRequestConfirm
                        serviceName={
                          selectedBookingService
                            ? serviceLineLabel(selectedBookingService)
                            : t.profile?.servicesOffered ?? "Service"
                        }
                        durationLabel={formatDurationLabel(selectedBookingService?.duration_minutes ?? null)}
                        dateLabel={
                          selectedBookingDate
                            ? `${new Date(selectedBookingDate + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" })}${
                                selectedBookingTime
                                  ? ` · ${formatBookingTimeRange(selectedBookingTime, selectedBookingService?.duration_minutes ?? null) || selectedBookingTime}`
                                  : ""
                              }`
                            : "-"
                        }
                        baseAmountCents={Math.max(
                          500,
                          Math.round(
                            Number(
                              selectedBookingService?.custom_price_min ??
                                selectedBookingService?.custom_price_max ??
                                pro.price_min ??
                                5
                            ) * 100
                          )
                        )}
                        profilePhone={clientProfilePhone}
                        squareLocationId={pro.square_location_id}
                        proProfileId={pro.id}
                        clientId={user.id}
                        onSubmit={async (confirmedPhone, paymentMeta) => {
                          const phoneNorm = phoneDigits(confirmedPhone);
                          if (phoneNorm.length === 10) {
                            const { error: phoneErr } = await supabase
                              .from("profiles")
                              .update({ phone: confirmedPhone.trim() })
                              .eq("user_id", user.id);
                            if (phoneErr) console.warn("profile phone update:", phoneErr.message);
                            setClientProfilePhone(confirmedPhone.trim());
                          }
                          if (selectedBookingDate && selectedBookingDate < todayStr) {
                            throw new Error(t.terms.bookingDateNotInPast ?? "You cannot book a date in the past.");
                          }
                          const { data: invProf, error: invProfErr } = await supabase
                            .from("profiles")
                            .select("address, full_name, phone, postal_code")
                            .eq("user_id", user.id)
                            .maybeSingle();
                          if (invProfErr) console.warn(invProfErr);
                          const addr = buildClientInvoiceContactBlock(invProf ?? null);
                          if (!addr) {
                            throw new Error(
                              locale === "fr"
                                ? "Ajoutez votre nom, téléphone, code postal et adresse complète dans Tableau de bord → Mon compte pour recevoir une facture conforme."
                                : "Add your name, phone, postal code, and full address under Dashboard → My account so your receipt can show your details and place of service."
                            );
                          }
                          const svc = selectedBookingService;
                          const mode = effectiveServiceLocationMode(pro, svc);
                          const travelCheck = await checkTravelDistanceForBooking({
                            pro,
                            mode,
                            clientChoice: bookingLocationChoice,
                            clientAddressForGeocode:
                              clientProfileAddressRaw?.trim() ||
                              (typeof invProf?.address === "string" ? invProf.address.trim() : "") ||
                              "",
                          });
                          if (travelCheck.status === "outside_radius") {
                            throw new Error(
                              proLocationOffers.offersWorkspace
                                ? (t.terms.bookingOutsideOfferWorkspace ?? "Outside service area - choose at their workspace.")
                                    .replace("{{km}}", String(Math.round(travelCheck.distanceKm)))
                                    .replace("{{radius}}", String(travelCheck.radiusKm))
                                : (t.terms.bookingOutsideNoWorkspace ?? "Outside this professional's service area.")
                                    .replace("{{km}}", String(Math.round(travelCheck.distanceKm)))
                                    .replace("{{radius}}", String(travelCheck.radiusKm)),
                            );
                          }
                          if (travelCheck.status === "error") throw new Error(travelCheck.message);
                          const travelSnap =
                            travelCheck.status === "ok"
                              ? { ok: true as const, snapshot: travelCheck.snapshot }
                              : {
                                  ok: true as const,
                                  snapshot: {
                                    service_location_choice: resolveBookingLocationChoice(mode, bookingLocationChoice),
                                    distance_km_snapshot: null,
                                    drive_minutes_snapshot: null,
                                  },
                                };
                          const growth = pro && hasGrowthServiceExtras(proFeatureTier);
                          const renewMonths = growth && svc?.renewal_interval_months != null ? svc.renewal_interval_months : null;
                          const wantsRenew = !!(growth && renewMonths && bookingClientRenewAnnually && selectedBookingDate);
                          const appointmentSummary =
                            selectedBookingDate
                              ? `${new Date(selectedBookingDate + "T12:00:00").toLocaleDateString(undefined, {
                                  dateStyle: "long",
                                })}${
                                  selectedBookingTime
                                    ? ` · ${formatBookingTimeRange(selectedBookingTime, selectedBookingService?.duration_minutes ?? null) || selectedBookingTime}`
                                    : ""
                                }`
                              : "";
                          const supplierAddress =
                            (typeof pro.business_address === "string" && pro.business_address.trim()) ||
                            (typeof pro.location === "string" && pro.location.trim()) ||
                            "";
                          if (!supplierAddress) {
                            throw new Error(
                              locale === "fr"
                                ? "Ce professionnel n'a pas d'adresse de facturation complète. Réessayez plus tard ou contactez le support."
                                : "This professional has not completed a billing address yet. Please try again later or contact support."
                            );
                          }
                          const supplierLegal =
                            (typeof pro.legal_business_name === "string" && pro.legal_business_name.trim()) ||
                            (pro.business_name ?? "").trim();
                          const serviceLine = svc
                            ? serviceLineLabel(svc)
                            : t.profile?.servicesOffered ?? "Service";
                          const serviceDescriptionDetailed = buildServiceDescriptionDetailed({
                            serviceLine,
                            durationLabel: formatDurationLabel(svc?.duration_minutes ?? null),
                            serviceAbout: svc?.description ?? null,
                          });
                          const memberIds = await (async () => {
                            const ids = [user.id, pro.user_id].filter(Boolean) as string[];
                            const { data: profs } = await supabase
                              .from("profiles")
                              .select("user_id, public_user_number")
                              .in("user_id", ids);
                            const byUser = new Map<string, string>();
                            for (const row of profs ?? []) {
                              const n = (row as { public_user_number?: string | null }).public_user_number?.trim();
                              if (n) byUser.set((row as { user_id: string }).user_id, n);
                            }
                            return {
                              client: byUser.get(user.id) ?? null,
                              pro: pro.user_id ? byUser.get(pro.user_id) ?? null : null,
                            };
                          })();
                          const invoice = buildBookingInvoiceSnapshotV2({
                            proProfileId: pro.id,
                            businessName: pro.business_name ?? "",
                            supplierLegalName: supplierLegal,
                            supplierAddress,
                            supplierGstNumber: pro.gst_registration_number ?? null,
                            supplierQstNumber: pro.qst_registration_number ?? null,
                            serviceName: serviceLine,
                            serviceDescriptionDetailed,
                            durationLabel: formatDurationLabel(svc?.duration_minutes ?? null),
                            appointmentSummary,
                            preferredDate: selectedBookingDate,
                            preferredTime: selectedBookingTime,
                            serviceDurationMinutes: svc?.duration_minutes ?? null,
                            serviceCategorySlug: svc?.category_slug ?? null,
                            serviceSlug: svc?.service_slug ?? null,
                            customerAddress: addr,
                            baseAmountCents: Math.max(
                              500,
                              Math.round(
                                Number(
                                  selectedBookingService?.custom_price_min ??
                                    selectedBookingService?.custom_price_max ??
                                    pro.price_min ??
                                    5
                                ) * 100
                              )
                            ),
                            currency: "cad",
                            squarePaymentId: paymentMeta.squarePaymentId ?? null,
                            idempotencyKey: paymentMeta.idempotencyKey,
                            paymentMethodLabel:
                              paymentMeta.paymentMethodLabel?.trim() ||
                              (locale === "fr" ? "Carte (pré-autorisation)" : "Card (authorized hold)"),
                            clientRenewsAnnually: wantsRenew,
                            renewalIntervalMonths: renewMonths,
                            renewalAnchorDate: wantsRenew && selectedBookingDate ? selectedBookingDate : null,
                            clientMemberNumber: memberIds.client,
                            proMemberNumber: memberIds.pro,
                          });
                          const cancelResolved = svc
                            ? resolveServiceCancelPolicy(svc)
                            : {
                                policy: normalizeBookingCancelPolicy(pro.booking_cancel_policy),
                                feeType: "percent" as const,
                                feePercent: normalizeBookingCancelFeePercent(pro.booking_cancel_fee_percent),
                                feeCents: 0,
                              };
                          const payload: Record<string, unknown> = {
                            pro_profile_id: pro.id,
                            client_id: user.id,
                            status: "pending",
                            service_duration_minutes: svc?.duration_minutes ?? null,
                            client_unread: false,
                            pro_unread: true,
                            invoice_snapshot: invoice,
                            cancel_policy_snapshot: cancelResolved.policy,
                            cancel_fee_percent_snapshot: cancelResolved.feePercent,
                            cancel_fee_type_snapshot: cancelResolved.feeType,
                            cancel_fee_cents_snapshot:
                              cancelResolved.feeType === "fixed" ? cancelResolved.feeCents : null,
                            cancel_policy_acknowledged_at: new Date().toISOString(),
                          };
                          if (selectedBookingDate) payload.preferred_date = selectedBookingDate;
                          if (selectedBookingTime) payload.preferred_time = selectedBookingTime;
                          if (svc) {
                            payload.service_category_slug = svc.category_slug;
                            payload.service_slug = svc.service_slug;
                            payload.auto_reply_snapshot = svc.auto_reply_message?.trim() || null;
                          }
                          payload.service_location_choice = travelSnap.snapshot.service_location_choice;
                          payload.distance_km_snapshot = travelSnap.snapshot.distance_km_snapshot;
                          payload.drive_minutes_snapshot = travelSnap.snapshot.drive_minutes_snapshot;
                          if (wantsRenew && renewMonths != null) {
                            payload.client_renews_annually = true;
                            payload.renewal_anchor_date = selectedBookingDate;
                            payload.renewal_interval_months_snapshot = renewMonths;
                          } else {
                            payload.client_renews_annually = false;
                            payload.renewal_anchor_date = null;
                            payload.renewal_interval_months_snapshot = renewMonths;
                          }
                          const insertBooking = async (row: Record<string, unknown>) =>
                            supabase.from("bookings").insert(row).select("id, invoice_number, public_booking_code").single();

                          let invoiceSnapshotStored = !!payload.invoice_snapshot;
                          let { data, error } = await insertBooking(payload);
                          if (error) {
                            const errorText = (e: NonNullable<typeof error>) =>
                              `${e.message ?? ""} ${(e as { details?: string }).details ?? ""}`;
                            let message = errorText(error);
                            if (message.toLowerCase().includes("invoice_snapshot")) {
                              const { invoice_snapshot: _omit, ...withoutSnapshot } = payload;
                              const retry = await insertBooking(withoutSnapshot);
                              data = retry.data;
                              error = retry.error;
                              invoiceSnapshotStored = false;
                              if (!error) {
                                console.warn(
                                  "bookings.invoice_snapshot column missing; booking saved without snapshot. Run supabase/PASTE-BOOKING-INVOICE-SNAPSHOT.sql in Supabase.",
                                );
                              } else {
                                message = errorText(error);
                              }
                            }
                            if (error && /cancel_policy|cancel_fee_percent|cancel_fee_type|cancel_fee_cents|cancel_policy_acknowledged/i.test(errorText(error))) {
                              const {
                                cancel_policy_snapshot: _a,
                                cancel_fee_percent_snapshot: _b,
                                cancel_fee_type_snapshot: _d,
                                cancel_fee_cents_snapshot: _e,
                                cancel_policy_acknowledged_at: _c,
                                ...withoutCancel
                              } = payload;
                              const retry = await insertBooking(withoutCancel);
                              data = retry.data;
                              error = retry.error;
                              if (error) message = errorText(error);
                            }
                            if (error) {
                              const missingScheduleColumn =
                                message.includes("preferred_time") ||
                                message.includes("preferred_date") ||
                                message.includes("service_duration_minutes");
                              const missingBizAddr = message.toLowerCase().includes("business_address");
                              const missingInvNo = message.toLowerCase().includes("invoice_number");
                              const missingPubCode = message.toLowerCase().includes("public_booking_code");
                              if (missingPubCode) {
                                throw new Error(
                                  "Your database is missing bookings.public_booking_code or its trigger. Apply migration 20260515120000_profiles_postal_booking_public_code.sql in Supabase, then try again."
                                );
                              }
                              if (missingInvNo) {
                                throw new Error(
                                  "Your database is missing bookings.invoice_number or the invoice sequence trigger. Apply migration 20260513120000_pro_billing_address_invoice_number.sql, then try again."
                                );
                              }
                              if (missingBizAddr) {
                                throw new Error(
                                  "Your database is missing pro_profiles.business_address. Apply the latest Supabase migration, then try again."
                                );
                              }
                              if (missingScheduleColumn) {
                                throw new Error(
                                  "Your Supabase bookings table is missing schedule columns. Run supabase/ADD-BOOKING-SCHEDULE-COLUMNS.sql in the Supabase SQL Editor, then refresh the schema cache/reload the site."
                                );
                              }
                              throw new Error(error.message);
                            }
                          }
                          if (data?.id && invoiceSnapshotStored) {
                            const invNo = (data as { invoice_number?: number }).invoice_number;
                            const pub = (data as { public_booking_code?: string }).public_booking_code;
                            const merged = {
                              ...invoice,
                              ...(typeof invNo === "number" ? { invoice_number: invNo } : {}),
                              ...(typeof pub === "string" && pub.trim() ? { booking_public_code: pub.trim().toUpperCase() } : {}),
                            };
                            const { error: snapErr } = await supabase
                              .from("bookings")
                              .update({ invoice_snapshot: merged })
                              .eq("id", data.id);
                            if (snapErr) console.warn("Could not merge invoice snapshot:", snapErr.message);
                          }
                          if (data?.id && paymentMeta.idempotencyKey) {
                            const { error: linkErr } = await supabase
                              .from("payments")
                              .update({ booking_id: data.id })
                              .eq("idempotency_key", paymentMeta.idempotencyKey);
                            if (linkErr) console.warn("payment link:", linkErr.message);
                          }
                          let idVerificationUploadFailed = false;
                          if (data?.id && user.id && bookingPhotoWithIdFile) {
                            try {
                              const path = await persistClientBookingIdVerificationOnProfile(
                                user.id,
                                bookingPhotoWithIdFile,
                                clientBookingIdPath,
                              );
                              setClientBookingIdPath(path);
                              setBookingPhotoWithIdFile(null);
                            } catch (uploadErr) {
                              console.warn("ID verification upload failed:", uploadErr);
                              idVerificationUploadFailed = true;
                            }
                          }
                          toast({ title: t.terms.requestBooking, description: t.terms.bookingRequestSent });
                          if (idVerificationUploadFailed) {
                            toast({
                              title: t.auth.toastError,
                              description: t.terms.bookingIdVerificationSaveFailed,
                              variant: "destructive",
                            });
                          }
                          if (data?.id) {
                            void supabase.functions.invoke("booking-sms-notify", {
                              body: { booking_id: data.id, event: "confirmation" },
                            });
                          }
                        }}
                        onError={(msg) =>
                          toast({
                            title: t.auth.toastError,
                            description: (
                              <span className="select-text break-words whitespace-pre-wrap">{msg}</span>
                            ),
                            variant: "destructive",
                          })
                        }
                        onDone={() => {
                          clearBookingCheckoutResume();
                          setBookingDialogOpen(false);
                          setBookingTermsAccepted(false);
                          setBookingStep(1);
                          setBookingPhotoWithIdFile(null);
                          setSelectedBookingDate(null);
                          setSelectedBookingTime(null);
                          setSelectedBookingService(null);
                          setBookingClientRenewAnnually(false);
                        }}
                      />
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 flex items-center gap-3">
                        <CreditCard className="size-8 text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground">{t.terms.stripePaymentPlaceholder}</p>
                        <Button asChild>
                          <Link
                            to={proId ? bookingCheckoutLoginPath(proId) : "/auth?mode=login"}
                            onClick={persistBookingCheckoutForLogin}
                          >
                            {locale === "fr" ? "Connexion pour réserver" : "Log in to book"}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </DialogContent>
            </Dialog>
        </div>
  );

  return (
    <Layout>
      {featuredLook ? (
        <ClickSpark sparkColor={pagePrimary} sparkCount={8} duration={400} sparkRadius={18}>
          {pageInner}
        </ClickSpark>
      ) : (
        pageInner
      )}
    </Layout>
  );
}
