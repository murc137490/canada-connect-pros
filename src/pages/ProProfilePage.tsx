import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Briefcase, Check,
  Loader2, ShieldCheck, CalendarCheck, CreditCard, ChevronRight, Share2, Info, X
} from "lucide-react";
import { serviceCategories } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import StarRating from "@/components/pro/StarRating";
import LicenseBadge from "@/components/pro/LicenseBadge";
import ReviewSection from "@/components/pro/ReviewSection";
import AvailabilityCalendar, { type UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import RecommendationSidebar from "@/components/pro/RecommendationSidebar";
import TermsAcceptance from "@/components/TermsAcceptance";
import AddressInput from "@/components/AddressInput";
import BookingCheckout from "@/components/BookingCheckout";
import { parseAvailabilityFromStorage, type AvailabilityState } from "@/components/WeekdayAvailability";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { geocodeAddress, distanceKm } from "@/lib/geocode";
import ClickSpark from "@/components/ClickSpark";
import StarBorder from "@/components/StarBorder";
import { getAccentHex } from "@/data/proAccentColors";

interface ProData {
  id: string;
  user_id: string;
  business_name: string;
  bio: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  service_at_workspace_only: boolean | null;
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
}

export default function ProProfilePage() {
  const { proId } = useParams<{ proId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      toast({ title: t.terms.requestBooking, description: t.terms.bookingRequestSent });
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete("payment"); return next; }, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, t.terms.requestBooking, t.terms.bookingRequestSent]);
  const [pro, setPro] = useState<ProData | null>(null);
  const [servesYourArea, setServesYourArea] = useState<boolean | null>(null);
  const [servesAreaLoading, setServesAreaLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null; is_primary?: boolean }[]>([]);
  const [services, setServices] = useState<{ service_slug: string; category_slug: string; description: string | null; custom_price_min: number | null; custom_price_max: number | null }[]>([]);
  const [licenses, setLicenses] = useState<{ license_number: string; license_type: string; is_verified: boolean }[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingTermsAccepted, setBookingTermsAccepted] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4>(1);
  const [bookingPhotoWithIdFile, setBookingPhotoWithIdFile] = useState<File | null>(null);
  const [bookingBirthday, setBookingBirthday] = useState("");
  const [bookingAddress, setBookingAddress] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [proBookings, setProBookings] = useState<
    { id: string; created_at?: string; preferred_date?: string | null; preferred_time?: string | null }[]
  >([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [lightboxImageDark, setLightboxImageDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"about" | "services" | "credentials">("about");
  const [selectedBookingDate, setSelectedBookingDate] = useState<string | null>(null);
  const [selectedBookingTime, setSelectedBookingTime] = useState<string | null>(null);
  const [selectedBookingService, setSelectedBookingService] = useState<typeof services[0] | null>(null);
  const [allServicesModalOpen, setAllServicesModalOpen] = useState(false);
  const [clientProfile, setClientProfile] = useState<{ birthday?: string | null; address?: string | null } | null>(null);
  const viewRecordedRef = useRef(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !bookingDialogOpen) return;
    supabase.from("profiles").select("birthday, address").eq("user_id", user.id).single().then(({ data }) => {
      setClientProfile(data ?? null);
      if (data?.birthday) setBookingBirthday(data.birthday || "");
      if (data?.address) setBookingAddress(data.address || "");
    });
  }, [user, bookingDialogOpen]);

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

    const availabilityState = parseAvailabilityFromStorage(pro.availability ?? null);
    const weekdayKey = weekdayKeyFromDateStr(selectedBookingDate);
    const dayState = availabilityState?.[weekdayKey] ?? null;

    const isDayOverride = (pro.available_date_overrides ?? []).includes(selectedBookingDate);

    const enabledMorning = isDayOverride ? true : !!dayState?.morning;
    const enabledAfternoon = isDayOverride ? true : !!dayState?.afternoon;
    const enabledEvening = isDayOverride ? true : !!dayState?.evening;

    // If we have a parsed weekday but none of the time ranges are enabled,
    // assume the whole typical day window is available (prevents empty schedules from old data).
    const shouldFallbackToAll =
      !availabilityState ||
      (!enabledMorning && !enabledAfternoon && !enabledEvening);

    const timeRanges: { startMin: number; endMin: number }[] = [];
    const pushRange = (startHour: number, endHour: number) => timeRanges.push({ startMin: startHour * 60, endMin: endHour * 60 });

    if (shouldFallbackToAll) {
      pushRange(8, 12);
      pushRange(12, 17);
      pushRange(17, 21);
    } else {
      if (enabledMorning) pushRange(8, 12);
      if (enabledAfternoon) pushRange(12, 17);
      if (enabledEvening) pushRange(17, 21);
    }

    const exceptions = pro.unavailable_dates?.[selectedBookingDate];
    if (exceptions === true) return [];

    const exceptionSlots = Array.isArray(exceptions) ? exceptions : [];

    const parseHHMMToMinutes = (s: string) => {
      const m = s.match(/^\\s*(\\d{2}):(\\d{2})\\s*$/);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = selectedBookingDate === todayStr;

    const candidateStarts = new Set<string>();
    for (const r of timeRanges) {
      for (let startMin = r.startMin; startMin + 60 <= r.endMin; startMin += 60) {
        const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
        const mm = String(startMin % 60).padStart(2, "0");
        const label = `${hh}:${mm}`;
        candidateStarts.add(label);
      }
    }

    const candidates = Array.from(candidateStarts).sort();

    // Remove time slots that overlap with unavailable exceptions.
    const filteredByExceptions = candidates.filter((time) => {
      const startMin = parseHHMMToMinutes(time);
      if (startMin == null) return false;
      const endMin = startMin + 60;

      for (const slot of exceptionSlots) {
        const slotStart = parseHHMMToMinutes(slot.start);
        const slotEnd = parseHHMMToMinutes(slot.end);
        if (slotStart == null || slotEnd == null) continue;
        const overlaps = startMin < slotEnd && endMin > slotStart;
        if (overlaps) return false;
      }
      return true;
    });

    // Remove times already booked.
    const bookingsForDate = proBookings.filter((b) => {
      const dateFromPreferred = b.preferred_date ? String(b.preferred_date) : null;
      const dateFromCreatedAt = b.created_at ? String(b.created_at).slice(0, 10) : null;
      return (dateFromPreferred ?? dateFromCreatedAt) === selectedBookingDate;
    });

    const takenTimes = new Set(
      bookingsForDate
        .map((b) => {
          const raw = b.preferred_time
            ? String(b.preferred_time)
            : b.created_at
              ? String(b.created_at).slice(11, 16)
              : "";
          const m = String(raw).match(/(\\d{2}:\\d{2})/);
          return m ? m[1] : null;
        })
        .filter((x): x is string => !!x)
    );

    const filteredByBookings = filteredByExceptions.filter((time) => !takenTimes.has(time));

    // If booking for today, don't allow selecting times in the past.
    const filteredByNow = filteredByBookings.filter((time) => {
      if (!isToday) return true;
      const startMin = parseHHMMToMinutes(time);
      if (startMin == null) return false;
      return startMin > nowMinutes;
    });

    return filteredByNow;
  }, [pro, selectedBookingDate, proBookings, todayStr]);

  useEffect(() => {
    if (!selectedBookingTime) return;
    if (!bookingTimeOptions.includes(selectedBookingTime)) setSelectedBookingTime(null);
  }, [bookingTimeOptions, selectedBookingTime]);

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
      setPro(proData as any);

      // Parallel fetches
      const [profileRes, photosRes, servicesRes, licensesRes, ratingRes, bookingsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", proData.user_id).single(),
        supabase.from("pro_photos").select("id, url, caption, is_primary").eq("pro_profile_id", proId).order("is_primary", { ascending: false }),
        supabase.from("pro_services").select("service_slug, category_slug, description, custom_price_min, custom_price_max").eq("pro_profile_id", proId),
        supabase.from("pro_licenses").select("license_number, license_type, is_verified").eq("pro_profile_id", proId),
        supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: proId }),
        supabase.from("bookings").select("id, created_at, preferred_date, preferred_time").eq("pro_profile_id", proId).in("status", ["pending", "completed"]),
      ]);

      setFullName(profileRes.data?.full_name || t.common.proFallback);
      const photoList = (photosRes.data || []) as { id: string; url: string; caption: string | null; is_primary?: boolean }[];
      setPhotos(photoList);
      const primaryOrFirstPhoto = photoList.find((p) => p.is_primary)?.url ?? photoList[0]?.url;
      setAvatarUrl(primaryOrFirstPhoto || profileRes.data?.avatar_url || null);
      setServices((servicesRes.data as any[]) || []);
      setLicenses((licensesRes.data as any[]) || []);
      setAvgRating(Number(ratingRes.data?.[0]?.avg_rating || 0));
      setReviewCount(Number(ratingRes.data?.[0]?.review_count || 0));
      setProBookings((bookingsRes.data as { id: string; created_at?: string; preferred_date?: string | null; preferred_time?: string | null }[]) || []);
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
    if (!pro || !user || pro.service_at_workspace_only) return;
    const lat = pro.latitude ?? null;
    const lng = pro.longitude ?? null;
    const radius = pro.service_radius_km ?? null;
    if (lat == null || lng == null || radius == null) return;

    (async () => {
      setServesAreaLoading(true);
      setServesYourArea(null);
      try {
        const { data } = await supabase.from("profiles").select("address").eq("user_id", user.id).single();
        const address = data?.address?.trim();
        if (!address) {
          setServesAreaLoading(false);
          return;
        }
        const coords = await geocodeAddress(address);
        if (!coords) {
          setServesAreaLoading(false);
          return;
        }
        const km = distanceKm(lat, lng, coords.lat, coords.lng);
        setServesYourArea(km <= radius);
      } finally {
        setServesAreaLoading(false);
      }
    })();
  }, [pro?.id, pro?.latitude, pro?.longitude, pro?.service_radius_km, user?.id]);

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
  const sidebarPrimary = pro.page_primary_color || "hsl(var(--primary))";
  const sidebarSecondary = pro.page_secondary_color || "hsl(var(--secondary))";
  const sidebarGradient = `linear-gradient(145deg, ${sidebarPrimary} 0%, ${sidebarSecondary} 45%, ${sidebarPrimary} 100%)`;
  const accentHex = getAccentHex(pro.pro_accent_color);
  const accentStyle = accentHex ? { color: accentHex } : undefined;
  const accentBgStyle = accentHex ? { backgroundColor: accentHex } : undefined;
  const accentBorderStyle = accentHex ? { borderColor: accentHex } : undefined;
  const serviceTags = (pro.service_tags || []).filter(Boolean);

  return (
    <Layout>
      <ClickSpark sparkColor="hsl(var(--primary))" sparkCount={8} duration={400} sparkRadius={18}>
        <div
          className="min-h-screen relative bg-background text-foreground"
          ref={pageContentRef}
        >
          <div className="container py-8 md:py-10 relative z-10">
          {/* Serves your area */}
          {!pro.service_at_workspace_only && user && (
            <div className="mb-8 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm">
              {servesAreaLoading && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> {t.services?.checkingYourArea ?? "Checking if we serve your area…"}
                </span>
              )}
              {!servesAreaLoading && servesYourArea === true && (
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Check size={18} className="text-green-600" /> {t.services.servesYourArea}
                </span>
              )}
              {!servesAreaLoading && servesYourArea === false && (
                <span className="flex items-center gap-2 text-muted-foreground">{t.services?.outsideServiceArea ?? "Does not serve your area."}</span>
              )}
              {!servesAreaLoading && servesYourArea == null && pro.latitude != null && (
                <Link to="/dashboard" className="text-primary hover:underline font-medium">{t.services.addAddressToCheck}</Link>
              )}
            </div>
          )}

          {/* Profile card: white with soft drop shadow */}
          <div className="rounded-2xl bg-white overflow-hidden mb-10 md:mb-14 border border-gray-100" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)" }}>
          {/* Header: very subtle neutral background (custom color from dashboard), soft shadow */}
          <header
            className="rounded-t-2xl overflow-hidden relative min-h-[180px]"
            style={{ backgroundColor: pro.page_background_color || "#F3F4F6" }}
          >
            {pro.banner_image_url && (
              <div className="absolute inset-0 z-[1]" aria-hidden>
                <img src={pro.banner_image_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-white/60" aria-hidden />
              </div>
            )}
            <div className="relative z-10 px-6 py-8 md:px-8 md:py-10">
            {pro.page_header_text && (
              <div className="prose prose-lg md:prose-xl max-w-none text-black prose-headings:text-black prose-p:text-black/80 mb-8" dangerouslySetInnerHTML={{ __html: pro.page_header_text }} />
            )}
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="w-20 h-20 rounded-xl border-2 shrink-0" style={accentHex ? { borderColor: accentHex } : { borderColor: "#E5E7EB" }}>
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-xl font-bold rounded-xl text-white" style={accentBgStyle || { backgroundColor: "hsl(var(--primary))" }}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl md:text-3xl font-bold text-black">{pro.business_name}</h1>
                  {pro.is_verified && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium text-white"
                      style={accentHex ? { backgroundColor: accentHex } : { backgroundColor: "hsl(var(--primary))" }}
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
                        className="text-xs px-2.5 py-0.5 rounded-full border font-medium bg-[#F7F7F7] text-black"
                        style={accentHex ? { borderColor: accentHex, color: accentHex } : { borderColor: "#E5E7EB" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-black/80 mt-1">{fullName}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <StarRating rating={avgRating} size={16} />
                  <span className="text-sm text-gray-800">({reviewCount} {reviewCount === 1 ? (t.common?.review ?? "review") : (t.common?.reviews ?? "reviews")})</span>
                </div>
                <Button
                  size="sm"
                  className={!accentHex ? "mt-3 gap-1.5 bg-primary text-white hover:bg-primary/90" : "mt-3 gap-1.5 text-white hover:opacity-90"}
                  style={accentBgStyle || undefined}
                  onClick={handleShare}
                >
                  <Share2 size={16} /> {t.common?.share ?? "Share"}
                </Button>
              </div>
            </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="flex flex-col gap-6 px-6 md:px-8 pt-2 pb-1">
            <div className="border-b border-gray-200">
              <div className="flex gap-1">
                {(["about", "services", "credentials"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
                      activeTab === tab
                        ? "bg-gray-100 border border-b-0 border-gray-200 text-black -mb-px"
                        : "text-black/70 hover:text-black"
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

          <div className="grid lg:grid-cols-3 gap-10 md:gap-14 px-6 md:px-8 pb-8 md:pb-10">
            {/* Main content: tab panels */}
            <div className="lg:col-span-2 space-y-10 md:space-y-14">
              {activeTab === "about" && (
                <>
                  {pro.bio && (
                    <section className="pt-2">
                      <h2 className="font-heading text-lg font-semibold text-black mb-2">About</h2>
                      <p className="text-black/80 leading-relaxed">{pro.bio}</p>
                    </section>
                  )}
                  <section>
                    <h2 className="font-heading text-lg font-semibold text-black mb-3">Overview</h2>
                    <ul className="space-y-2 text-sm text-black/80">
                      {pro.years_experience > 0 && (
                        <li className="flex items-center gap-2">
                          <Briefcase size={16} className="shrink-0" style={accentStyle} />
                          {pro.years_experience} {t.common?.yearsExp ?? "years experience"}
                        </li>
                      )}
                    </ul>
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
                      <h2 className="font-heading text-lg font-semibold text-black mb-3">{t.profile?.servicesOffered ?? "Services offered"}</h2>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {services.map((svc) => (
                          <span
                            key={svc.service_slug}
                            className="px-3 py-1.5 rounded-full border bg-[#F7F7F7] text-black text-sm font-medium"
                            style={accentBorderStyle}
                          >
                            {getServiceName(svc.service_slug, locale, svc.service_slug.replace(/-/g, " "))}
                          </span>
                        ))}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-black/80">
                        {services.map((svc) => (
                          <div key={svc.service_slug} className="flex items-start gap-2">
                            <Check size={16} className="shrink-0 mt-0.5" style={accentStyle} />
                            <div>
                              <span className="font-medium text-black">{getServiceName(svc.service_slug, locale, svc.service_slug.replace(/-/g, " "))}</span>
                              {svc.description && <p className="text-black/80 mt-0.5">{svc.description}</p>}
                              {(svc.custom_price_min || svc.custom_price_max) && (
                                <p className={`font-medium mt-1 ${!accentHex ? "text-primary" : ""}`} style={accentStyle}>
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
                  {photos.length > 0 && (
                    <section>
                      <h2 className="font-heading text-lg font-semibold text-black mb-3">Portfolio</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {photos.map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            className="relative rounded-lg overflow-hidden border border-border aspect-square p-0 block w-full text-left cursor-pointer hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                            onClick={() => setLightboxPhoto(photo.url)}
                            aria-label={photo.caption || t.common.workPhoto}
                          >
                            <img src={photo.url} alt={photo.caption || t.common.workPhoto} className="w-full h-full object-cover pointer-events-none" />
                            {photo.caption && (
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 p-2">
                                <p className="text-xs text-black">{photo.caption}</p>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {activeTab === "credentials" && (
                <>
                  {licenses.length > 0 && (
                    <section>
                      <h2 className="font-heading text-lg font-semibold text-black mb-3 flex items-center gap-2">
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
                      <p className="text-sm text-black/80 mt-2">
                        {fullName} · <button type="button" className="text-primary hover:underline">{t.profile?.viewCredentialDetails ?? "View credential details"}</button>
                      </p>
                    </section>
                  )}
                </>
              )}

              <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-2 bg-black/90 border-0 overflow-hidden [&>button:last-of-type]:hidden">
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

            {/* Sidebar: contrast layering — booking card white, guarantee light gray, calendar white */}
            <aside className="lg:sticky lg:top-24 space-y-5 self-start">
              <div className="rounded-xl p-6 bg-white shadow-md border border-gray-100">
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
                        <p className="text-2xl font-bold text-black">
                          {t.profile?.startingPrice ?? "Starting price"}: ${Number(minServicePrice).toLocaleString()}
                        </p>
                        {services.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAllServicesModalOpen(true)}
                            className="text-sm font-medium mt-1 underline hover:no-underline text-black/80 hover:text-black focus:outline-none"
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
                        <p className="text-2xl font-bold text-black">
                          {t.profile?.startingPrice ?? "Starting price"}: {pro.price_min != null ? `$${Number(pro.price_min).toLocaleString()}` : pro.price_max != null ? `$${Number(pro.price_max).toLocaleString()}` : "—"}
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
                          className="text-sm font-medium underline hover:no-underline text-black/80 hover:text-black focus:outline-none"
                        >
                          {t.profile?.clickHereForAllServices ?? "Click here for all services"}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
                <StarBorder as="div" color="rgba(0,0,0,0.08)" speed="4s" thickness={2} className="w-full mb-3" innerClassName="!bg-transparent !border-0 !p-0">
                  <Button
                    className="w-full min-h-12 py-4 text-base font-semibold gap-2 rounded-lg border-2 text-white hover:opacity-90"
                    style={accentHex ? { backgroundColor: accentHex, borderColor: accentHex } : { backgroundColor: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" }}
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
                <div className="space-y-1.5 text-xs text-black/80 mt-3">
                  <p className="flex items-center gap-2">✔ {t.terms?.securePayment ?? "Secure payment"}</p>
                  <p className="flex items-center gap-2">✔ {t.guarantee?.title ?? "Booking protection"}</p>
                  <p className="flex items-center gap-2">✔ {t.common?.verified ?? "Verified professional"}</p>
                </div>
              </div>
              <div className="rounded-xl p-6 bg-gray-100 border border-gray-200/80 shadow-sm">
                <h3 className="font-semibold text-black text-sm mb-2">{t.guarantee?.title ?? "Booking Guarantee"}</h3>
                <p className="text-xs text-black/80 leading-relaxed">{t.guarantee?.rebookingDesc ?? "If something goes wrong, we'll help you rebook at no extra cost."}</p>
                <Link to="/terms" className="text-xs text-black font-medium hover:underline mt-2 inline-block">{t.common?.learnMore ?? "Learn more"}</Link>
              </div>
              <div className="rounded-xl p-6 bg-white shadow-md border border-gray-100">
                <h3 className="font-semibold text-black text-sm mb-2">{t.profile?.availability ?? "Availability"}</h3>
                <p className="text-xs text-black/80 mb-2">{t.profile?.clickDateToBook ?? "Click an available date to request a booking."}</p>
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
          <DialogContent className="max-w-md bg-white text-black border border-gray-200 shadow-xl">
            <DialogHeader>
              <DialogTitle>{t.profile?.allServicesTitle ?? "All services"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
              {services.map((svc) => {
                const price = svc.custom_price_min ?? svc.custom_price_max ?? null;
                const priceStr = price != null ? `$${Number(price)}` : "";
                const shortName = getServiceName(svc.service_slug, locale, svc.service_slug.replace(/-/g, " "));
                return (
                  <div
                    key={`${svc.category_slug}-${svc.service_slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-black truncate">{shortName}</p>
                      {priceStr && <p className="text-sm text-black/70">{priceStr}</p>}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedBookingService(svc);
                        setAllServicesModalOpen(false);
                        setBookingDialogOpen(true);
                      }}
                      style={accentHex ? { backgroundColor: accentHex, borderColor: accentHex } : undefined}
                      className={!accentHex ? "" : "text-white border-2"}
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
                setBookingStep(1);
                setBookingPhotoWithIdFile(null);
                setBookingBirthday("");
                setBookingAddress("");
                setSelectedBookingDate(null);
                setSelectedBookingTime(null);
                setSelectedBookingService(null);
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
                    {bookingStep === 2 && t.terms.bookingConfirmTitle}
                    {bookingStep === 3 && t.terms.bookingStepVerification}
                  </DialogTitle>
                </DialogHeader>
                )}

                {bookingStep === 1 && (
                  <>
                    {services.length >= 1 && (
                      <div className="space-y-2 mb-4">
                        <Label className="text-white">{t.profile?.servicesOffered ?? "Service"}</Label>
                        <div className="space-y-2">
                          {services.map((svc) => {
                            const price = svc.custom_price_min ?? svc.custom_price_max ?? 0;
                            const priceStr = price ? `$${Number(price)}` : "";
                            const isSelected = selectedBookingService?.category_slug === svc.category_slug && selectedBookingService?.service_slug === svc.service_slug;
                            return (
                              <button
                                key={`${svc.category_slug}-${svc.service_slug}`}
                                type="button"
                                onClick={() => setSelectedBookingService(svc)}
                                className={`w-full text-left rounded-lg border-2 px-3 py-2.5 text-sm transition-colors ${isSelected ? "border-white bg-white/20 text-white" : "border-gray-600 bg-gray-800/50 text-white/90 hover:bg-gray-700/50"}`}
                              >
                                <span className="font-medium">{getServiceName(svc.service_slug, locale, svc.service_slug.replace(/-/g, " "))}</span>
                                {priceStr && <span className="ml-2 text-white/80">— {priceStr}</span>}
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
                    <p className="text-sm text-white/80 mt-4">{t.terms.bookingConfirmMessage}</p>
                    <TermsAcceptance
                      variant="booking"
                      accepted={bookingTermsAccepted}
                      onAcceptedChange={setBookingTermsAccepted}
                      inDialog
                      submitLabel={t.terms.continueToVerification ?? "Continue"}
                      onSubmit={() => {
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
                        {t.profile?.servicesOffered ?? "Service"}: <strong className="text-white">{getServiceName(selectedBookingService.service_slug, locale, selectedBookingService.service_slug.replace(/-/g, " "))}</strong>
                        {" — "}
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
                            at <strong className="text-white">{selectedBookingTime}</strong>
                          </>
                        ) : null}
                      </p>
                    )}
                    <div className="space-y-4">
                    {!clientProfile?.birthday && (
                    <div className="space-y-2">
                      <Label className="text-white">{t.terms.bookingPhotoWithId}</Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setBookingPhotoWithIdFile(e.target.files?.[0] ?? null)}
                        className="cursor-pointer bg-gray-800 border-gray-600 text-white"
                      />
                      <p className="text-xs text-white/80">{t.terms.bookingPhotoWithIdHint}</p>
                    </div>
                    )}
                    {!clientProfile?.birthday && (
                    <div className="space-y-2">
                      <Label htmlFor="booking-birthday" className="text-white">{t.terms.bookingBirthday}</Label>
                      <Input
                        id="booking-birthday"
                        type="date"
                        value={bookingBirthday}
                        onChange={(e) => setBookingBirthday(e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white"
                      />
                    </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="booking-address" className="text-white">{t.terms.bookingAddress}</Label>
                      <AddressInput
                        key={`booking-addr-${bookingDialogOpen}`}
                        id="booking-address"
                        value={bookingAddress}
                        onChange={setBookingAddress}
                        placeholder={t.terms.bookingAddressPlaceholder}
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-white/50"
                      />
                      {!import.meta.env.VITE_GOOGLE_PLACES_API_KEY && (
                        <p className="text-xs text-amber-400">
                          {t.terms.bookingAddressNoPlaces ?? "Add VITE_GOOGLE_PLACES_API_KEY and enable Places API in Google Cloud for address dropdown."}
                        </p>
                      )}
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
                        const hasBirthday = bookingBirthday.trim() || clientProfile?.birthday;
                        const needsPhoto = !clientProfile?.birthday;
                        if (needsPhoto && !bookingPhotoWithIdFile) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingFillVerification, variant: "destructive" });
                          return;
                        }
                        if (!hasBirthday || !bookingAddress.trim()) {
                          toast({ title: t.auth.toastError, description: t.terms.bookingFillVerification, variant: "destructive" });
                          return;
                        }
                        setBookingStep(4);
                      }}
                    >
                      {t.terms.continueToPayment} <ChevronRight size={16} />
                    </Button>
                  </div>
                  </>
                )}

                {bookingStep === 4 && pro && (
                  <>
                    {user ? (
                      <BookingCheckout
                        serviceName={
                          selectedBookingService
                            ? getServiceName(selectedBookingService.service_slug, locale, selectedBookingService.service_slug.replace(/-/g, " "))
                            : t.profile?.servicesOffered ?? "Service"
                        }
                        durationLabel={
                          selectedBookingService?.description?.match(/Duration:\s*(.+)/i)?.[1]?.trim() ?? null
                        }
                        dateLabel={
                          selectedBookingDate
                            ? `${new Date(selectedBookingDate + "T12:00:00").toLocaleDateString(undefined, { dateStyle: "long" })}${selectedBookingTime ? ` · ${selectedBookingTime}` : ""}`
                            : "—"
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
                        currency="cad"
                        proProfileId={pro.id}
                        clientId={user.id}
                        onPaymentComplete={async () => {
                          if (selectedBookingDate && selectedBookingDate < todayStr) {
                            throw new Error(t.terms.bookingDateNotInPast ?? "You cannot book a date in the past.");
                          }
                          const payload: {
                            pro_profile_id: string;
                            client_id: string;
                            status: string;
                            preferred_date?: string;
                            preferred_time?: string | null;
                          } = {
                            pro_profile_id: pro.id,
                            client_id: user.id,
                            status: "completed",
                          };
                          if (selectedBookingDate) payload.preferred_date = selectedBookingDate;
                          if (selectedBookingTime) payload.preferred_time = selectedBookingTime;
                          const { data, error } = await supabase.from("bookings").insert(payload).select("id").single();
                          if (error) throw new Error(error.message);
                          toast({ title: t.terms.requestBooking, description: t.terms.bookingRequestSent });
                          return { bookingId: data?.id };
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
                          setBookingDialogOpen(false);
                          setBookingTermsAccepted(false);
                          setBookingStep(1);
                          setBookingPhotoWithIdFile(null);
                          setBookingBirthday("");
                          setBookingAddress("");
                          setSelectedBookingDate(null);
                          setSelectedBookingTime(null);
                        }}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 flex items-center gap-3">
                        <CreditCard className="size-8 text-muted-foreground shrink-0" />
                        <p className="text-sm text-muted-foreground">{t.terms.stripePaymentPlaceholder}</p>
                        <Button asChild><Link to="/auth?mode=login">Log in to pay</Link></Button>
                      </div>
                    )}
                  </>
                )}
              </DialogContent>
            </Dialog>
        </div>
      </ClickSpark>
    </Layout>
  );
}
