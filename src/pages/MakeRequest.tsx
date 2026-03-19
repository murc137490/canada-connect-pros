import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { geocodePostalToLocation } from "@/lib/geocode";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, MapPin } from "lucide-react";

const CATEGORIES = [
  { value: "Plumbing", labelKey: "categoryPlumbing" as const },
  { value: "HVAC", labelKey: "categoryHVAC" as const },
  { value: "Cleaning", labelKey: "categoryCleaning" as const },
  { value: "Handyman", labelKey: "categoryHandyman" as const },
  { value: "Furniture Assembly", labelKey: "categoryFurniture" as const },
  { value: "Moving", labelKey: "categoryMoving" as const },
  { value: "Other", labelKey: "categoryOther" as const },
] as const;

const TIMING_OPTIONS = [
  { value: "asap", labelKey: "timingAsap" as const },
  { value: "few_days", labelKey: "timingFewDays" as const },
  { value: "this_week", labelKey: "timingThisWeek" as const },
  { value: "flexible", labelKey: "timingFlexible" as const },
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

export default function MakeRequest() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Other");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [timing, setTiming] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth?mode=login&redirect=/make-request", { replace: true });
      return;
    }
  }, [user, navigate]);

  useEffect(() => {
    if (description.trim().length > 20) {
      const inferred = inferCategory(description);
      setCategory((c) => (c === "Other" ? inferred : c));
    }
  }, [description]);

  const handlePostalBlur = async () => {
    const code = postalCode.trim().replace(/\s+/g, "");
    if (code.length < 3) return;
    setLocationLoading(true);
    try {
      const loc = await geocodePostalToLocation(code);
      if (loc) {
        setCity(loc.city ?? "");
        setProvince(loc.province ?? "");
        setLat(loc.lat);
        setLng(loc.lng);
      }
    } catch {
      toast({ title: t.makeRequest.toastLocationError, variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return description.trim().length >= 10;
    if (step === 2) return true;
    if (step === 3) return postalCode.trim().length >= 3;
    if (step === 4) return true;
    if (step === 5) return true;
    if (step === 6) return true;
    return false;
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const aiCategory = inferCategory(description);

      // Limit: max 2 open job requests per customer per day.
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const { count } = await supabase
        .from("job_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user.id)
        .eq("status", "open")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());

      if ((count ?? 0) >= 2) {
        toast({
          title: t.makeRequest.toastError ?? "Limit reached",
          description: "You can post at most 2 open requests per day. Edit an existing request in your dashboard or try again tomorrow.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from("job_requests")
        .insert({
          client_id: user.id,
          description: description.trim(),
          category: category || aiCategory,
          postal_code: postalCode.trim() || null,
          city: city.trim() || null,
          province: province.trim() || null,
          latitude: lat ?? null,
          longitude: lng ?? null,
          photo_urls: photoUrls,
          budget_range: budgetMin || budgetMax ? [budgetMin.trim(), budgetMax.trim()].filter(Boolean).join("-") : null,
          timing: timing || null,
          ai_category: aiCategory,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: t.makeRequest.toastSuccess, description: t.makeRequest.toastSuccessDesc });
      navigate("/dashboard?tab=bookings", { replace: true });
    } catch (e) {
      toast({ title: t.makeRequest.toastError, description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

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
              <Label htmlFor="description">{t.makeRequest.step1Label}</Label>
              <Textarea
                id="description"
                placeholder={t.makeRequest.step1Placeholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[140px] resize-y"
                maxLength={2000}
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

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <Label htmlFor="postal">{t.makeRequest.step3Label}</Label>
              <Input
                id="postal"
                placeholder={t.makeRequest.step3Placeholder}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                onBlur={handlePostalBlur}
              />
              {locationLoading && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> {t.makeRequest.step3Detecting}
                </p>
              )}
              {(city || province) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={16} />
                  <span>{[city, province].filter(Boolean).join(", ")}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {t.makeRequest.step3Hint}
              </p>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step4Label}</Label>
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t.makeRequest.step4ComingSoon}</p>
                {photoUrls.length > 0 && (
                  <p className="text-xs mt-2">{photoUrls.length} {t.makeRequest.step4PhotosAdded}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step5Label}</Label>
              <p className="text-sm text-muted-foreground">{t.makeRequest.step5Hint}</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="budget-min" className="text-muted-foreground shrink-0">{t.makeRequest.step5Min}</Label>
                  <Input
                    id="budget-min"
                    type="number"
                    min={0}
                    step={10}
                    placeholder={t.makeRequest.step5MinPlaceholder}
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="w-28"
                  />
                </div>
                <span className="text-muted-foreground">–</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor="budget-max" className="text-muted-foreground shrink-0">{t.makeRequest.step5Max}</Label>
                  <Input
                    id="budget-max"
                    type="number"
                    min={0}
                    step={10}
                    placeholder={t.makeRequest.step5MaxPlaceholder}
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="w-28"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 6 */}
          {step === 6 && (
            <div className="space-y-4">
              <Label>{t.makeRequest.step6Label}</Label>
              <div className="space-y-2">
                {TIMING_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="timing"
                      value={opt.value}
                      checked={timing === opt.value}
                      onChange={() => setTiming(opt.value)}
                      className="rounded-full border-input"
                    />
                    <span>{t.makeRequest[opt.labelKey]}</span>
                  </label>
                ))}
              </div>
            </div>
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
            {step < 6 ? (
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
