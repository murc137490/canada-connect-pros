import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TimingAndDateFields from "@/components/job-request/TimingAndDateFields";
import { supabase } from "@/integrations/supabase/client";
import { createLocalDateTime, schedulingDbFieldsFromFormState } from "@/lib/jobRequestScheduling";
import {
  formatCanadianPostalInput,
  geocodePostalToLocation,
  isCompleteCanadianPostal,
} from "@/lib/geocode";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Loader2, Upload, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { isContentBlocked } from "@/lib/contentModeration";
import { jobRequestRulesList } from "@/lib/jobRequestRules";

const REQUEST_PHOTOS_BUCKET = "job-request-photos";
const MAX_REQUEST_PHOTOS = 5;
const TOTAL_STEPS = 4;

const CATEGORIES = [
  { value: "Plumbing", labelKey: "categoryPlumbing" as const },
  { value: "HVAC", labelKey: "categoryHVAC" as const },
  { value: "Cleaning", labelKey: "categoryCleaning" as const },
  { value: "Handyman", labelKey: "categoryHandyman" as const },
  { value: "Furniture Assembly", labelKey: "categoryFurniture" as const },
  { value: "Moving", labelKey: "categoryMoving" as const },
  { value: "Other", labelKey: "categoryOther" as const },
] as const;

function inferCategory(description: string): string {
  const d = description.toLowerCase();
  if (/\b(plumb|pipe|leak|faucet|toilet|drain|sink|plomb)\b/.test(d)) return "Plumbing";
  if (/\b(hvac|furnace|ac|heat|air|duct|thermostat|cvac|cvc)\b/.test(d)) return "HVAC";
  if (/\b(clean|housekeeping|ménage|menage|nettoyage)\b/.test(d)) return "Cleaning";
  if (/\b(handyman|fix|repair|install|ceiling fan|bricole)\b/.test(d)) return "Handyman";
  if (/\b(furniture|assembly|ikea|meuble)\b/.test(d)) return "Furniture Assembly";
  if (/\b(mov(e|ing)|pack|déménag|demenag)\b/.test(d)) return "Moving";
  return "Other";
}

function isJobRequestDailyLimitError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : String((err as { message?: string })?.message ?? (err as { details?: string })?.details ?? err ?? "");
  return /JOB_REQUEST_DAILY_LIMIT/i.test(msg) || /\bP0001\b/i.test(msg);
}

function mapsEmbedUrl(lat: number, lng: number, hl: "en" | "fr"): string {
  const q = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps?q=${q}&z=14&hl=${hl}&output=embed`;
}

export default function MakeRequest() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [timing, setTiming] = useState("");
  const [preferredDate, setPreferredDate] = useState<Date | undefined>(undefined);
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState<"range" | "specific_day" | "exact">("specific_day");
  const [rangeStartDate, setRangeStartDate] = useState<Date | undefined>(undefined);
  const [rangeEndDate, setRangeEndDate] = useState<Date | undefined>(undefined);
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [exactTime, setExactTime] = useState("");
  const [postalLookup, setPostalLookup] = useState<{
    status: "idle" | "loading" | "found" | "not-found";
    city: string | null;
    province: string | null;
    label: string;
    lat: number | null;
    lng: number | null;
  }>({ status: "idle", city: null, province: null, label: "", lat: null, lng: null });
  const [photos, setPhotos] = useState<File[]>([]);
  const allowLeaveRef = useRef(false);
  const shouldWarnOnLeaveRef = useRef(false);
  const leaveWarn = t.makeRequest.leaveWarn;

  const stepNav = [
    t.makeRequest.stepNavNeed,
    t.makeRequest.stepNavLocation,
    t.makeRequest.stepNavDetails,
    t.makeRequest.stepNavTiming,
  ] as const;

  const photoPreviewUrls = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  const hasDraft = useMemo(
    () =>
      description.trim().length > 0 ||
      postalCode.trim().length > 0 ||
      category !== "Other" ||
      budgetMin.trim().length > 0 ||
      budgetMax.trim().length > 0 ||
      timing.trim().length > 0 ||
      preferredDate != null ||
      preferredTimeWindow.trim().length > 0 ||
      rangeStartDate != null ||
      rangeEndDate != null ||
      startHour.trim().length > 0 ||
      endHour.trim().length > 0 ||
      exactTime.trim().length > 0 ||
      photos.length > 0,
    [
      budgetMax,
      budgetMin,
      category,
      description,
      endHour,
      exactTime,
      photos.length,
      postalCode,
      preferredDate,
      preferredTimeWindow,
      rangeEndDate,
      rangeStartDate,
      startHour,
      timing,
    ]
  );

  useEffect(() => {
    return () => {
      photoPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviewUrls]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      allowLeaveRef.current = true;
      navigate("/auth?mode=login&redirect=/make-request", { replace: true });
    }
  }, [user, navigate, authLoading]);

  useEffect(() => {
    if (description.trim().length > 20) {
      const inferred = inferCategory(description);
      setCategory((c) => (c === "Other" ? inferred : c));
    }
  }, [description]);

  useEffect(() => {
    if (!isCompleteCanadianPostal(postalCode)) {
      setPostalLookup({ status: "idle", city: null, province: null, label: "", lat: null, lng: null });
      return;
    }

    let active = true;
    setPostalLookup((prev) => ({ ...prev, status: "loading" }));
    const timeout = window.setTimeout(() => {
      void (async () => {
        const location = await geocodePostalToLocation(formatCanadianPostalInput(postalCode));
        if (!active) return;
        if (!location) {
          setPostalLookup({ status: "not-found", city: null, province: null, label: "", lat: null, lng: null });
          return;
        }
        const label =
          [location.city, location.province].filter(Boolean).join(", ") ||
          location.formattedAddress ||
          "";
        setPostalLookup({
          status: label || location.lat != null ? "found" : "not-found",
          city: location.city,
          province: location.province,
          label,
          lat: location.lat,
          lng: location.lng,
        });
      })();
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [postalCode]);

  useEffect(() => {
    shouldWarnOnLeaveRef.current = hasDraft && !submitting && !allowLeaveRef.current;
  }, [hasDraft, submitting]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldWarnOnLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = leaveWarn;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [leaveWarn]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldWarnOnLeaveRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== "_self") return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const nextUrl = new URL(target.href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;
      if (window.confirm(leaveWarn)) {
        allowLeaveRef.current = true;
        shouldWarnOnLeaveRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [leaveWarn]);

  const goToStep = (next: number) => {
    const clamped = Math.min(TOTAL_STEPS, Math.max(1, next));
    setStep(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const canProceed = () => {
    if (step === 1) return description.trim().length >= 10;
    if (step === 2) return isCompleteCanadianPostal(postalCode) && postalLookup.status === "found";
    if (step === 3) return true;
    if (step === 4) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (isContentBlocked(description)) {
        toast({
          title: t.makeRequest.toastError,
          description: t.makeRequest.requestBlockedDesc,
          variant: "destructive",
        });
        return;
      }
      const { data: profBlock } = await supabase
        .from("profiles")
        .select("job_requests_blocked_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profBlock?.job_requests_blocked_at) {
        toast({
          title: t.makeRequest.toastError,
          description: t.makeRequest.requestAccountBlockedDesc,
          variant: "destructive",
        });
        return;
      }
      const aiCategory = inferCategory(description);
      const normalizedPostal = formatCanadianPostalInput(postalCode);
      if (!isCompleteCanadianPostal(normalizedPostal)) {
        toast({ title: t.makeRequest.toastError, description: t.makeRequest.step3Label, variant: "destructive" });
        goToStep(2);
        return;
      }

      const location =
        postalLookup.status === "found" && postalLookup.lat != null && postalLookup.lng != null
          ? {
              lat: postalLookup.lat,
              lng: postalLookup.lng,
              city: postalLookup.city,
              province: postalLookup.province,
              formattedAddress: postalLookup.label || undefined,
            }
          : await geocodePostalToLocation(normalizedPostal);
      if (!location) {
        toast({ title: t.makeRequest.toastLocationError, description: t.makeRequest.step3Hint, variant: "destructive" });
        goToStep(2);
        return;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { data: proProfileRow } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).maybeSingle();

      if (!proProfileRow) {
        const { count } = await supabase
          .from("job_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", user.id)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString());

        if ((count ?? 0) >= 2) {
          toast({
            title: t.makeRequest.toastDailyLimitTitle,
            description: t.makeRequest.toastDailyLimitDesc,
            variant: "destructive",
          });
          return;
        }
      }

      const minBudget = budgetMin.trim();
      const maxBudget = budgetMax.trim();

      const uploadedPhotoUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(REQUEST_PHOTOS_BUCKET).upload(path, photo, {
          contentType: photo.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from(REQUEST_PHOTOS_BUCKET).getPublicUrl(path);
        uploadedPhotoUrls.push(urlData.publicUrl);
      }

      const preferredDateForPayload = availabilityMode === "range" ? rangeStartDate : preferredDate;
      const preferredDateString = preferredDateForPayload ? format(preferredDateForPayload, "yyyy-MM-dd") : null;
      const exactDateTime =
        availabilityMode === "exact" && preferredDate && exactTime
          ? createLocalDateTime(preferredDate, exactTime)
          : null;
      const preferredDatetime = exactDateTime
        ? exactDateTime.toISOString()
        : preferredDateString != null
          ? `${preferredDateString}T12:00:00.000Z`
          : null;
      const mk = t.makeRequest as Record<string, string>;
      const schedulingFields = schedulingDbFieldsFromFormState(
        {
          availabilityMode,
          preferredTimeWindow,
          preferredDate,
          rangeStartDate,
          rangeEndDate,
          startHour,
          endHour,
          exactTime,
        },
        mk
      );

      const requestPayload: Record<string, unknown> = {
        client_id: user.id,
        description: description.trim(),
        category: category || aiCategory,
        postal_code: normalizedPostal,
        city: location.city,
        province: location.province,
        latitude: location.lat,
        longitude: location.lng,
        photo_urls: uploadedPhotoUrls,
        budget_range: minBudget || maxBudget ? [minBudget, maxBudget].filter(Boolean).join("-") : null,
        timing: timing || null,
        preferred_datetime: preferredDatetime,
        preferred_date: preferredDateString,
        preferred_time_window: schedulingFields.preferred_time_window,
        scheduling_mode: schedulingFields.scheduling_mode,
        time_window_code: schedulingFields.time_window_code,
        range_start_date: schedulingFields.range_start_date,
        range_end_date: schedulingFields.range_end_date,
        exact_time: schedulingFields.exact_time,
        window_time_start: schedulingFields.window_time_start,
        window_time_end: schedulingFields.window_time_end,
        ai_category: aiCategory,
        status: "open",
        updated_at: new Date().toISOString(),
      };

      let { data, error } = await supabase.from("job_requests").insert(requestPayload).select("id").single();
      if (error && /preferred_date|preferred_time_window|preferred_datetime|scheduling_mode|schema cache|column/i.test(error.message)) {
        const {
          preferred_date: _preferredDate,
          preferred_time_window: _preferredTimeWindow,
          preferred_datetime: _preferredDatetime,
          scheduling_mode: _scheduling_mode,
          time_window_code: _time_window_code,
          range_start_date: _range_start_date,
          range_end_date: _range_end_date,
          exact_time: _exact_time,
          window_time_start: _window_time_start,
          window_time_end: _window_time_end,
          ...fallbackPayload
        } = requestPayload;
        ({ data, error } = await supabase.from("job_requests").insert(fallbackPayload).select("id").single());
      }
      if (error) {
        if (isJobRequestDailyLimitError(error)) {
          toast({
            title: t.makeRequest.toastDailyLimitTitle,
            description: t.makeRequest.toastDailyLimitDesc,
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      void data;
      toast({ title: t.makeRequest.toastSuccess, description: t.makeRequest.toastSuccessDesc });
      allowLeaveRef.current = true;
      navigate("/dashboard?tab=bookings", { replace: true });
    } catch (e) {
      toast({ title: t.makeRequest.toastError, description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoChange = (files: FileList | null) => {
    const incoming = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setPhotos((prev) => {
      const next = [...prev, ...incoming].slice(0, MAX_REQUEST_PHOTOS);
      if (prev.length + incoming.length > MAX_REQUEST_PHOTOS) {
        toast({
          title: t.makeRequest.toastError,
          description: t.makeRequest.step4MaxPhotos,
          variant: "destructive",
        });
      }
      return next;
    });
  };

  if (authLoading || !user) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page">
        <div className="container max-w-2xl py-10 px-4">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">{t.makeRequest.title}</h1>
          <p className="text-muted-foreground mb-6">{t.makeRequest.subtitle}</p>

          <nav aria-label={t.makeRequest.stepProgress.replace("{n}", String(step))} className="mb-8">
            <ol className="flex items-center gap-1 sm:gap-2">
              {stepNav.map((label, index) => {
                const n = index + 1;
                const active = n === step;
                const done = n < step;
                return (
                  <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (n < step) goToStep(n);
                      }}
                      disabled={n > step}
                      className={cn(
                        "flex w-full min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-center transition-colors",
                        active && "bg-primary/10",
                        done && "cursor-pointer hover:bg-muted/60",
                        n > step && "opacity-45 cursor-not-allowed"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums border",
                          active && "border-primary bg-primary text-primary-foreground",
                          done && "border-primary/40 bg-primary/15 text-primary",
                          !active && !done && "border-border bg-background text-muted-foreground"
                        )}
                      >
                        {n}
                      </span>
                      <span
                        className={cn(
                          "truncate text-[11px] sm:text-xs font-medium w-full",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {label}
                      </span>
                    </button>
                    {n < TOTAL_STEPS ? (
                      <span className={cn("hidden sm:block h-px w-3 shrink-0", done ? "bg-primary/50" : "bg-border")} aria-hidden />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Remount panel on step change so the form view clears/resets visually */}
          <div key={step} className="animate-in fade-in-0 slide-in-from-right-2 duration-200">
            {step === 1 && (
              <div className="space-y-5">
                <Collapsible open={rulesOpen} onOpenChange={setRulesOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="group inline-flex items-center gap-1.5 border-b border-foreground/70 pb-0.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      {t.makeRequest.rulesToggle}
                      <ChevronDown
                        className={cn(
                          "size-4 transition-transform duration-200",
                          rulesOpen && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
                      {jobRequestRulesList(locale).map((rule) => (
                        <li key={rule}>{rule}</li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-2">
                  <Label htmlFor="description">{t.makeRequest.step1Label}</Label>
                  <Textarea
                    id="description"
                    placeholder={t.makeRequest.step1Placeholder}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[140px] resize-y"
                    maxLength={2000}
                  />
                  <p className="text-sm text-muted-foreground">{t.makeRequest.step1Tip}</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                  <div className="space-y-2">
                    <Label htmlFor="postal-code">{t.makeRequest.step3Label}</Label>
                    <Input
                      id="postal-code"
                      placeholder={t.makeRequest.step3Placeholder}
                      value={postalCode}
                      onChange={(e) => setPostalCode(formatCanadianPostalInput(e.target.value))}
                      autoComplete="postal-code"
                      inputMode="text"
                      maxLength={7}
                    />
                    <p className="text-sm text-muted-foreground">{t.makeRequest.step3Hint}</p>
                    {postalLookup.status === "loading" && (
                      <p className="text-sm text-muted-foreground">{t.makeRequest.step3Detecting}</p>
                    )}
                    {postalLookup.status === "found" && (
                      <p className="text-sm font-medium text-primary">
                        {t.makeRequest.step3DetectedLocation}: {postalLookup.label}
                      </p>
                    )}
                    {postalLookup.status === "not-found" && (
                      <p className="text-sm text-destructive">{t.makeRequest.step3LocationNotFound}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t.makeRequest.mapPreviewLabel}</Label>
                    <div className="overflow-hidden rounded-md border border-border bg-muted/40 aspect-[4/3] sm:aspect-square">
                      {postalLookup.status === "found" && postalLookup.lat != null && postalLookup.lng != null ? (
                        <iframe
                          title={t.makeRequest.mapPreviewLabel}
                          src={mapsEmbedUrl(postalLookup.lat, postalLookup.lng, locale)}
                          className="h-full w-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                          {postalLookup.status === "loading" ? t.makeRequest.step3Detecting : t.makeRequest.mapWaiting}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div className="space-y-2">
                  <Label htmlFor="category">{t.makeRequest.step2Label}</Label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {t.makeRequest[c.labelKey]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <Label>{t.makeRequest.step4Label}</Label>
                  <label className="block cursor-pointer rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground transition-colors hover:bg-muted/40">
                    <Upload size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t.makeRequest.step4UploadHint}</p>
                    <p className="text-xs mt-2">
                      {photos.length} {t.makeRequest.step4PhotosAdded}
                    </p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        handlePhotoChange(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {photoPreviewUrls.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={url} className="relative overflow-hidden rounded-lg border bg-muted">
                          <img src={url} alt="" className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-foreground shadow"
                            onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                            aria-label={locale === "fr" ? "Retirer" : "Remove"}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <Label>{t.makeRequest.step5Label}</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="budget-min" className="text-muted-foreground shrink-0">
                        {t.makeRequest.step5Min}
                      </Label>
                      <Input
                        id="budget-min"
                        type="text"
                        inputMode="numeric"
                        placeholder={t.makeRequest.step5MinPlaceholder}
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value.replace(/[^\d]/g, ""))}
                        className="w-28"
                      />
                    </div>
                    <span className="text-muted-foreground">–</span>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="budget-max" className="text-muted-foreground shrink-0">
                        {t.makeRequest.step5Max}
                      </Label>
                      <Input
                        id="budget-max"
                        type="text"
                        inputMode="numeric"
                        placeholder={t.makeRequest.step5MaxPlaceholder}
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value.replace(/[^\d]/g, ""))}
                        className="w-28"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <TimingAndDateFields
                timing={timing}
                onTimingChange={setTiming}
                preferredDate={preferredDate}
                onPreferredDateChange={setPreferredDate}
                timeWindow={preferredTimeWindow}
                onTimeWindowChange={setPreferredTimeWindow}
                availabilityMode={availabilityMode}
                onAvailabilityModeChange={setAvailabilityMode}
                rangeStartDate={rangeStartDate}
                rangeEndDate={rangeEndDate}
                onRangeDateChange={(from, to) => {
                  setRangeStartDate(from);
                  setRangeEndDate(to);
                }}
                startHour={startHour}
                onStartHourChange={setStartHour}
                endHour={endHour}
                onEndHourChange={setEndHour}
                exactTime={exactTime}
                onExactTimeChange={setExactTime}
              />
            )}
          </div>

          <div className="flex justify-between mt-10">
            <Button type="button" variant="outline" onClick={() => goToStep(step - 1)} disabled={step === 1}>
              {t.makeRequest.back}
            </Button>
            {step < TOTAL_STEPS ? (
              <Button type="button" onClick={() => goToStep(step + 1)} disabled={!canProceed()}>
                {t.makeRequest.next}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting || !canProceed()}>
                {submitting && <Loader2 size={16} className="animate-spin mr-2" />}
                {t.makeRequest.submit}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
