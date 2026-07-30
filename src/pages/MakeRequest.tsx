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
import { geocodePostalToLocation } from "@/lib/geocode";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isContentBlocked } from "@/lib/contentModeration";
import { jobRequestRulesList } from "@/lib/jobRequestRules";

const REQUEST_PHOTOS_BUCKET = "job-request-photos";
const MAX_REQUEST_PHOTOS = 5;
const LEAVE_REQUEST_MESSAGE = "Do you want to leave? The information will be discarded.";

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
  if (/\b(plumb|pipe|leak|faucet|toilet|drain|sink)\b/.test(d)) return "Plumbing";
  if (/\b(hvac|furnace|ac|heat|air|duct|thermostat)\b/.test(d)) return "HVAC";
  if (/\b(clean|housekeeping)\b/.test(d)) return "Cleaning";
  if (/\b(handyman|fix|repair|install|ceiling fan)\b/.test(d)) return "Handyman";
  if (/\b(furniture|assembly|ikea)\b/.test(d)) return "Furniture Assembly";
  if (/\b(mov(e|ing)|pack)\b/.test(d)) return "Moving";
  return "Other";
}

function normalizePostalCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

function isJobRequestDailyLimitError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : String((err as { message?: string })?.message ?? (err as { details?: string })?.details ?? err ?? "");
  return /JOB_REQUEST_DAILY_LIMIT/i.test(msg) || /\bP0001\b/i.test(msg);
}

export default function MakeRequest() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
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
  }>({ status: "idle", city: null, province: null, label: "" });
  const [photos, setPhotos] = useState<File[]>([]);
  const allowLeaveRef = useRef(false);
  const shouldWarnOnLeaveRef = useRef(false);

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
      return;
    }
  }, [user, navigate, authLoading]);

  useEffect(() => {
    if (description.trim().length > 20) {
      const inferred = inferCategory(description);
      setCategory((c) => (c === "Other" ? inferred : c));
    }
  }, [description]);

  useEffect(() => {
    const normalizedPostal = normalizePostalCode(postalCode);
    const compactPostal = normalizedPostal.replace(/\s/g, "");
    if (compactPostal.length < 6) {
      setPostalLookup({ status: "idle", city: null, province: null, label: "" });
      return;
    }

    let active = true;
    setPostalLookup((prev) => ({ ...prev, status: "loading" }));
    const timeout = window.setTimeout(() => {
      void (async () => {
        const location = await geocodePostalToLocation(normalizedPostal);
        if (!active) return;
        if (!location) {
          setPostalLookup({ status: "not-found", city: null, province: null, label: "" });
          return;
        }
        const label =
          [location.city, location.province].filter(Boolean).join(", ") ||
          location.formattedAddress ||
          "";
        setPostalLookup({
          status: label ? "found" : "not-found",
          city: location.city,
          province: location.province,
          label,
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
      event.returnValue = LEAVE_REQUEST_MESSAGE;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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
      if (window.confirm(LEAVE_REQUEST_MESSAGE)) {
        allowLeaveRef.current = true;
        shouldWarnOnLeaveRef.current = false;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, []);

  const canProceed = () => {
    if (step === 1) return description.trim().length >= 10 && normalizePostalCode(postalCode).length >= 3;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return true;
    if (step === 5) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      if (isContentBlocked(description)) {
        toast({
          title: t.makeRequest.toastError,
          description: t.makeRequest.requestBlockedDesc ?? "This request cannot be posted. Review the service rules.",
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
          description:
            t.makeRequest.requestAccountBlockedDesc ??
            "Your account cannot post new requests due to repeated policy violations.",
          variant: "destructive",
        });
        return;
      }
      const aiCategory = inferCategory(description);
      const normalizedPostal = normalizePostalCode(postalCode);
      if (!normalizedPostal) {
        toast({ title: t.makeRequest.toastError, description: t.makeRequest.step3Label, variant: "destructive" });
        return;
      }

      const location = await geocodePostalToLocation(normalizedPostal);
      if (!location) {
        toast({ title: t.makeRequest.toastLocationError, description: t.makeRequest.step3Hint, variant: "destructive" });
        return;
      }

      // Limit: max 2 job requests per calendar day for client accounts (no pro_profiles row). Pros exempt.
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
      const exactDateTime = availabilityMode === "exact" && preferredDate && exactTime
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

      let { data, error } = await supabase
        .from("job_requests")
        .insert(requestPayload)
        .select("id")
        .single();
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
          description: t.makeRequest.step4MaxPhotos ?? `You can upload up to ${MAX_REQUEST_PHOTOS} photos.`,
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
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">
            {t.makeRequest.title}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t.makeRequest.subtitle}
          </p>

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <Alert>
                <AlertTitle>{t.makeRequest.rulesTitle ?? "Service request rules"}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1 text-sm mt-2">
                    {jobRequestRulesList(locale).map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="postal-code">{t.makeRequest.step3Label}</Label>
                <Input
                  id="postal-code"
                  placeholder={t.makeRequest.step3Placeholder}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  autoComplete="postal-code"
                />
                <p className="text-sm text-muted-foreground">{t.makeRequest.step3Hint}</p>
                {postalLookup.status === "loading" && (
                  <p className="text-sm text-muted-foreground">{t.makeRequest.step3Detecting}</p>
                )}
                {postalLookup.status === "found" && (
                  <p className="text-sm font-medium text-primary">
                    {(t.makeRequest.step3DetectedLocation ?? "Detected location")}: {postalLookup.label}
                  </p>
                )}
                {postalLookup.status === "not-found" && (
                  <p className="text-sm text-destructive">
                    {t.makeRequest.step3LocationNotFound ?? "We could not detect a city for this postal code yet."}
                  </p>
                )}
              </div>
              <Label htmlFor="description">{t.makeRequest.step1Label}</Label>
              <Textarea
                id="description"
                placeholder={normalizePostalCode(postalCode) ? t.makeRequest.step1Placeholder : "Enter postal code first"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px] resize-y"
                maxLength={2000}
                disabled={!normalizePostalCode(postalCode)}
              />
              <p className="text-sm text-muted-foreground">
                {t.makeRequest.step1Tip}
              </p>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step2Label}</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t.makeRequest[c.labelKey]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Step 3 (photos) */}
          {step === 3 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step4Label}</Label>
              <label className="block cursor-pointer rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground transition-colors hover:bg-muted/40">
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t.makeRequest.step4UploadHint ?? "Choose up to 5 photos to help pros quote accurately."}</p>
                <p className="text-xs mt-2">{photos.length} {t.makeRequest.step4PhotosAdded}</p>
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
                        aria-label={t.common?.remove ?? "Remove"}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Step 4 (budget) */}
          {step === 4 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step5Label}</Label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="budget-min" className="text-muted-foreground shrink-0">{t.makeRequest.step5Min}</Label>
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
                  <Label htmlFor="budget-max" className="text-muted-foreground shrink-0">{t.makeRequest.step5Max}</Label>
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
          )}

          {/* Step 5 (timing) */}
          {step === 5 && (
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

          <div className="flex justify-between mt-10">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              {t.makeRequest.back}
            </Button>
            {step < 5 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
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
