import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TermsAcceptance from "@/components/TermsAcceptance";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { serviceCategories } from "@/data/services";
import { PRO_PAGE_COLOR_SCHEMES, getSchemeById } from "@/data/proPageColorSchemes";
import { SERVICE_TAG_OPTIONS } from "@/data/serviceTags";
import {
  CANADIAN_LANGUAGES,
  YEARS_EXPERIENCE_OPTIONS,
  getCategoryName,
  type LanguageLevel,
} from "@/i18n/constants";
import { getSubcategoryName, getServiceName } from "@/i18n/serviceTranslations";
import WeekdayAvailability, {
  defaultAvailability,
  availabilityToStorage,
  type AvailabilityState,
} from "@/components/WeekdayAvailability";
import AvailabilityCalendar, { type UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import ProPagePhonePreview from "@/components/pro/ProPagePhonePreview";
import ProServiceAreaMap, { type ServiceAreaValue } from "@/components/ProServiceAreaMap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, X, Plus } from "lucide-react";

const STORAGE_BUCKET = "pro-photos";
const MAX_BIO_WORDS = 300;
const ACCEPT_IMAGES = "image/png,image/jpeg,image/jpg";

export default function CreateProAccount() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [availabilityNotYet, setAvailabilityNotYet] = useState(true);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDatesMap>({});
  const [availableDateOverrides, setAvailableDateOverrides] = useState<string[]>([]);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState("");
  const [dayModalAvailableByWeekday, setDayModalAvailableByWeekday] = useState(true);
  const [dayModalWholeDay, setDayModalWholeDay] = useState(false);
  const [dayModalSlots, setDayModalSlots] = useState<{ start: string; end: string }[]>([{ start: "15:00", end: "18:00" }]);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const beforeAfterInputRef = useRef<HTMLInputElement>(null);
  const personalPhotoInputRef = useRef<HTMLInputElement>(null);
  const idDocumentInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstNameOrBusiness: "",
    profilePhotoFile: null as File | null,
    personalPhotoFile: null as File | null,
    idDocumentFile: null as File | null,
    shortBio: "",
    yearsExperience: null as number | null,
    serviceAreas: "",
    startingPrice: "",
    certifications: "",
    insurance: true,
    selectedServices: [] as string[],
    languagesSpoken: [] as { code: string; level: LanguageLevel }[],
    beforeAfterFiles: [] as File[],
    availability: defaultAvailability(),
  });
  const [serviceAtWorkspaceOnly, setServiceAtWorkspaceOnly] = useState(false);
  const [serviceAreaValue, setServiceAreaValue] = useState<ServiceAreaValue>({
    latitude: null,
    longitude: null,
    service_radius_km: 25,
    location: null,
  });
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("");
  const [selectedSubcategoryName, setSelectedSubcategoryName] = useState("");
  const [pageTemplate, setPageTemplate] = useState<string>("classic");
  const [pageColorSchemeId, setPageColorSchemeId] = useState<string>("navyTeal");
  const [pagePrimaryColor, setPagePrimaryColor] = useState("#1e3a5f");
  const [pageSecondaryColor, setPageSecondaryColor] = useState("#0d9488");
  const [pageAccentColor, setPageAccentColor] = useState("#e0f2f1");
  const [pageBackgroundColor, setPageBackgroundColor] = useState("#f8fafc");
  const [pageHeaderText, setPageHeaderText] = useState("");
  const [proServiceTags, setProServiceTags] = useState<string[]>([]);

  const wordCount = form.shortBio.trim() ? form.shortBio.trim().split(/\s+/).length : 0;
  const bioOverLimit = wordCount > MAX_BIO_WORDS;

  if (!user) {
    return (
      <Layout>
        <div className="container py-12 px-4 text-center">
          <p className="text-muted-foreground mb-4">{t.joinPros.loginMessage}</p>
          <Button asChild>
            <Link to="/auth?mode=login&redirect=/create-pro-account">{t.nav.logIn}</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const levelLabel = (level: LanguageLevel) => {
    if (level === "basic") return t.createPro.languageLevelBasic;
    if (level === "conversational") return t.createPro.languageLevelConversational;
    return t.createPro.languageLevelFluent;
  };

  const uploadFile = async (path: string, file: File): Promise<string> => {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.toastRequiredDesc, variant: "destructive" });
      return;
    }
    if (bioOverLimit) {
      toast({ title: t.createPro.toastBioTooLong, description: t.createPro.toastBioTooLongDesc.replace("{max}", String(MAX_BIO_WORDS)), variant: "destructive" });
      return;
    }
    if (!form.firstNameOrBusiness.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.firstNameOrBusiness + " is required.", variant: "destructive" });
      return;
    }
    if (!form.shortBio.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.shortBio + " is required.", variant: "destructive" });
      return;
    }
    if (form.yearsExperience == null) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.yearsExperience + " is required.", variant: "destructive" });
      return;
    }
    if (form.selectedServices.length === 0) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.serviceCategories + " — select at least one service.", variant: "destructive" });
      return;
    }
    if (!form.serviceAreas.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.serviceAreas + " is required.", variant: "destructive" });
      return;
    }
    if (!form.startingPrice.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.startingPrice + " is required.", variant: "destructive" });
      return;
    }
    if (!form.profilePhotoFile) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.profilePhotoUpload, variant: "destructive" });
      return;
    }
    if (form.beforeAfterFiles.length < 1) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.workPhotosRequired, variant: "destructive" });
      return;
    }
    if (!form.personalPhotoFile) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.personalPhotoLabel, variant: "destructive" });
      return;
    }
    if (!form.idDocumentFile) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.idDocumentLabel, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const priceMin = form.startingPrice ? parseInt(form.startingPrice.replace(/\D/g, ""), 10) || null : null;
      const availabilityStr = availabilityNotYet ? null : availabilityToStorage(form.availability);
      const languagesText =
        form.languagesSpoken.length > 0
          ? "Languages: " +
            form.languagesSpoken
              .map(({ code, level }) => {
                const lang = CANADIAN_LANGUAGES.find((l) => l.code === code);
                const name = locale === "fr" ? lang?.nameFr : lang?.nameEn;
                return `${name ?? code} (${levelLabel(level)})`;
              })
              .join(", ")
          : "";
      const bioWithLanguages = form.shortBio.trim() + (languagesText ? "\n\n" + languagesText : "");

      const { data: existing } = await supabase.from("pro_profiles").select("id").eq("user_id", user.id).maybeSingle();
      let profileId: string | undefined = existing?.id;

      const ext = (f: File) => f.name.split(".").pop() || "jpg";
      let personalPhotoUrl: string | null = null;
      let idDocumentUrl: string | null = null;
      if (form.personalPhotoFile) {
        const path = `${user.id}/private/personal-${Date.now()}.${ext(form.personalPhotoFile)}`;
        personalPhotoUrl = await uploadFile(path, form.personalPhotoFile);
      }
      if (form.idDocumentFile) {
        const path = `${user.id}/private/id-${Date.now()}.${ext(form.idDocumentFile)}`;
        idDocumentUrl = await uploadFile(path, form.idDocumentFile);
      }

      const locationDisplay = serviceAreaValue.location || form.serviceAreas || null;
      // Omit personal_photo_url and id_document_url so creation works even if those columns are not yet added (run ADD-PRO-PRIVATE-FIELDS.sql to persist them).
      const payload: Record<string, unknown> = {
        business_name: form.firstNameOrBusiness || "My Business",
        bio: bioWithLanguages.slice(0, 5000),
        years_experience: form.yearsExperience,
        location: locationDisplay,
        latitude: serviceAreaValue.latitude,
        longitude: serviceAreaValue.longitude,
        service_at_workspace_only: serviceAtWorkspaceOnly,
        service_radius_km: serviceAtWorkspaceOnly ? null : serviceAreaValue.service_radius_km,
        availability: availabilityStr,
        price_min: priceMin,
        updated_at: new Date().toISOString(),
      };
      if (Object.keys(unavailableDates).length > 0 || availableDateOverrides.length > 0) {
        payload.unavailable_dates = unavailableDates;
        payload.available_date_overrides = availableDateOverrides;
      }
      payload.page_template = null;
      payload.page_primary_color = pagePrimaryColor || null;
      payload.page_secondary_color = pageSecondaryColor || null;
      payload.page_accent_color = pageAccentColor || null;
      payload.page_background_color = pageBackgroundColor || null;
      payload.page_header_text = null;
      payload.service_tags = proServiceTags.length > 0 ? proServiceTags : null;

      if (existing?.id) {
        await supabase.from("pro_profiles").update(payload).eq("id", existing.id);
        await supabase.from("pro_services").delete().eq("pro_profile_id", existing.id);
      } else {
        const { updated_at: _, ...insertPayload } = payload;
        const { data: newPro, error: proError } = await supabase
          .from("pro_profiles")
          .insert({
            ...insertPayload,
            user_id: user.id,
            is_verified: false,
          })
          .select("id")
          .single();
        if (proError) throw proError;
        if (!newPro?.id) throw new Error("Failed to create profile");
        profileId = newPro.id;
      }

      if (!profileId) throw new Error("Pro profile not found");

      for (const key of form.selectedServices) {
        const [categorySlug, serviceSlug] = key.split("/");
        if (categorySlug && serviceSlug) {
          await supabase.from("pro_services").insert({
            pro_profile_id: profileId,
            category_slug: categorySlug,
            service_slug: serviceSlug,
          });
        }
      }

      if (form.profilePhotoFile) {
        const path = `${user.id}/profile-${Date.now()}.${form.profilePhotoFile.name.split(".").pop() || "jpg"}`;
        const url = await uploadFile(path, form.profilePhotoFile);
        await supabase.from("pro_photos").delete().eq("pro_profile_id", profileId).eq("is_primary", true);
        await supabase.from("pro_photos").insert({
          pro_profile_id: profileId,
          url,
          is_primary: true,
        });
      }

      for (let i = 0; i < form.beforeAfterFiles.length; i++) {
        const file = form.beforeAfterFiles[i];
        const path = `${user.id}/gallery-${Date.now()}-${i}.${file.name.split(".").pop() || "jpg"}`;
        const url = await uploadFile(path, file);
        await supabase.from("pro_photos").insert({
          pro_profile_id: profileId,
          url,
          caption: "before_after",
          is_primary: false,
        });
      }

      toast({
        title: t.createPro.toastSuccessTitle,
        description: t.createPro.toastSuccessDesc,
      });
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg.includes("Bucket not found") || msg.includes("storage")) {
        toast({
          title: t.createPro.toastUploadError,
          description: t.createPro.toastUploadErrorDesc,
          variant: "destructive",
        });
      } else {
        toast({ title: t.createPro.toastError, description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (key: string) => {
    setForm((prev) => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(key)
        ? prev.selectedServices.filter((s) => s !== key)
        : [...prev.selectedServices, key],
    }));
  };

  const addLanguage = (code: string, level: LanguageLevel) => {
    if (form.languagesSpoken.some((l) => l.code === code)) return;
    setForm((prev) => ({ ...prev, languagesSpoken: [...prev.languagesSpoken, { code, level }] }));
  };
  const removeLanguage = (code: string) => {
    setForm((prev) => ({ ...prev, languagesSpoken: prev.languagesSpoken.filter((l) => l.code !== code) }));
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-page dark:text-white">
        <div className="container max-w-2xl py-8 md:py-12 px-4 md:px-6 dark:[&_p]:text-white dark:[&_label]:text-white dark:[&_.text-muted-foreground]:text-white">
        <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground dark:text-white mb-2">{t.createPro.title}</h1>
        <p className="text-muted-foreground dark:text-white mb-6 md:mb-8 leading-relaxed">{t.createPro.subtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
          <div className="space-y-2">
            <Label htmlFor="firstNameOrBusiness">{t.createPro.firstNameOrBusiness} *</Label>
            <Input
              id="firstNameOrBusiness"
              value={form.firstNameOrBusiness}
              onChange={(e) => setForm((p) => ({ ...p, firstNameOrBusiness: e.target.value }))}
              placeholder={t.createPro.placeholderName}
              className="w-full"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.profilePhotoUpload}</Label>
            <input
              ref={profileInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              className="hidden"
              onChange={(e) => setForm((p) => ({ ...p, profilePhotoFile: e.target.files?.[0] ?? null }))}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => profileInputRef.current?.click()}
              >
                <Upload size={16} /> {t.createPro.chooseFile}
              </Button>
              {form.profilePhotoFile && (
                <span className="text-sm text-muted-foreground truncate">
                  {form.profilePhotoFile.name}
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, profilePhotoFile: null }))}
                    className="ml-1 text-destructive"
                  >
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{locale === "fr" ? "Confidentialité" : "Privacy"}</p>
            <p>{t.createPro.securityNotice}</p>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.personalPhotoLabel}</Label>
            <input
              ref={personalPhotoInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              className="hidden"
              onChange={(e) => setForm((p) => ({ ...p, personalPhotoFile: e.target.files?.[0] ?? null }))}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => personalPhotoInputRef.current?.click()}
              >
                <Upload size={16} /> {t.createPro.chooseFile}
              </Button>
              {form.personalPhotoFile && (
                <span className="text-sm text-muted-foreground truncate">
                  {form.personalPhotoFile.name}
                  <button type="button" onClick={() => setForm((p) => ({ ...p, personalPhotoFile: null }))} className="ml-1 text-destructive">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.idDocumentLabel}</Label>
            <input
              ref={idDocumentInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              className="hidden"
              onChange={(e) => setForm((p) => ({ ...p, idDocumentFile: e.target.files?.[0] ?? null }))}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => idDocumentInputRef.current?.click()}
              >
                <Upload size={16} /> {t.createPro.chooseFile}
              </Button>
              {form.idDocumentFile && (
                <span className="text-sm text-muted-foreground truncate">
                  {form.idDocumentFile.name}
                  <button type="button" onClick={() => setForm((p) => ({ ...p, idDocumentFile: null }))} className="ml-1 text-destructive">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG or PDF</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortBio">{t.createPro.shortBio} ({wordCount}/{MAX_BIO_WORDS})</Label>
            <Textarea
              id="shortBio"
              value={form.shortBio}
              onChange={(e) => setForm((p) => ({ ...p, shortBio: e.target.value }))}
              rows={5}
              className={`w-full resize-y ${bioOverLimit ? "border-destructive" : ""}`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.yearsExperience} *</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.yearsExperience ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, yearsExperience: e.target.value ? parseInt(e.target.value, 10) : null }))}
              required
            >
              <option value="">—</option>
              {YEARS_EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === "fr" ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.serviceCategories} *</Label>
            <p className="text-xs text-muted-foreground mb-2">{t.createPro.moreCategories}</p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]"
                  value={selectedCategorySlug}
                  onChange={(e) => {
                    setSelectedCategorySlug(e.target.value);
                    setSelectedSubcategoryName("");
                  }}
                >
                  <option value="">— {t.createPro.selectCategory} —</option>
                  {serviceCategories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {getCategoryName(cat, locale)}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[180px]"
                  value={selectedSubcategoryName}
                  onChange={(e) => setSelectedSubcategoryName(e.target.value)}
                  disabled={!selectedCategorySlug}
                >
                  <option value="">— {t.createPro.selectSubcategory} —</option>
                  {serviceCategories
                    .find((c) => c.slug === selectedCategorySlug)
                    ?.subcategories.map((sub) => (
                      <option key={sub.name} value={sub.name}>
                        {getSubcategoryName(selectedCategorySlug, sub.name, locale)}
                      </option>
                    ))}
                </select>
              </div>
              {selectedCategorySlug && selectedSubcategoryName && (
                <div className="border rounded-lg p-3 bg-muted/20 max-h-56 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t.createPro.checkServices}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {serviceCategories
                      .find((c) => c.slug === selectedCategorySlug)
                      ?.subcategories.find((s) => s.name === selectedSubcategoryName)
                      ?.services.map((svc) => {
                        const key = `${selectedCategorySlug}/${svc.slug}`;
                        return (
                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={form.selectedServices.includes(key)}
                              onCheckedChange={() => toggleService(key)}
                            />
                            <span className="text-sm">{getServiceName(svc.slug, locale, svc.name)}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
              {form.selectedServices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.selectedServices.length} {t.createPro.servicesSelected}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.serviceAreaMap}</Label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="serviceType"
                  checked={serviceAtWorkspaceOnly}
                  onChange={() => setServiceAtWorkspaceOnly(true)}
                  className="rounded-full"
                />
                <span className="text-sm">{t.createPro.serviceAtWorkspaceOnly}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="serviceType"
                  checked={!serviceAtWorkspaceOnly}
                  onChange={() => setServiceAtWorkspaceOnly(false)}
                  className="rounded-full"
                />
                <span className="text-sm">{t.createPro.serviceTravelToClient}</span>
              </label>
            </div>
            <ProServiceAreaMap
              value={serviceAreaValue}
              onChange={(v) => {
                setServiceAreaValue(v);
                if (v.location) setForm((p) => ({ ...p, serviceAreas: v.location ?? p.serviceAreas }));
              }}
              atWorkspaceOnly={serviceAtWorkspaceOnly}
              centerPlaceholder={t.createPro.serviceAreaCentrePlaceholder}
              radiusLabel={t.createPro.serviceRadiusLabel}
              useMyLocationLabel={t.createPro.useMyLocation}
            />
            <Label htmlFor="serviceAreas" className="mt-2 block">{t.createPro.serviceAreas} *</Label>
            <Input
              id="serviceAreas"
              value={form.serviceAreas}
              onChange={(e) => setForm((p) => ({ ...p, serviceAreas: e.target.value }))}
              placeholder={t.createPro.placeholderPostal}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingPrice">{t.createPro.startingPrice} *</Label>
            <Input
              id="startingPrice"
              value={form.startingPrice}
              onChange={(e) => setForm((p) => ({ ...p, startingPrice: e.target.value }))}
              placeholder={t.createPro.placeholderPrice}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.availability}</Label>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="availability-not-yet"
                checked={availabilityNotYet}
                onCheckedChange={(v) => setAvailabilityNotYet(v === true)}
              />
              <Label htmlFor="availability-not-yet" className="text-sm font-normal cursor-pointer">
                {t.createPro.availabilityNotYet ?? "Not yet (I'll fill this later)"}
              </Label>
            </div>
            {!availabilityNotYet && (
              <>
                <p className="text-xs text-muted-foreground mb-1">{t.createPro.regularAvailabilityHint ?? "Set your regular weekly availability (days and timeframes). Use the calendar below for specific date exceptions."}</p>
                <WeekdayAvailability value={form.availability} onChange={(v) => setForm((p) => ({ ...p, availability: v }))} />
                <Label className="mt-3 block">{t.createPro.specificDates ?? "Specific date exceptions"}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t.createPro.calendarClickHint ?? "Click a day to mark it unavailable (whole day or time slots) or to mark a usually-unavailable day as available."}</p>
                <div className="grid md:grid-cols-3 gap-3 mt-1">
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={0}
                    onDayClick={(dateStr, isAvail) => { setDayModalDate(dateStr); setDayModalAvailableByWeekday(isAvail); setDayModalWholeDay(false); setDayModalSlots([{ start: "15:00", end: "18:00" }]); setDayModalOpen(true); }}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={1}
                    onDayClick={(dateStr, isAvail) => { setDayModalDate(dateStr); setDayModalAvailableByWeekday(isAvail); setDayModalWholeDay(false); setDayModalSlots([{ start: "15:00", end: "18:00" }]); setDayModalOpen(true); }}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={2}
                    onDayClick={(dateStr, isAvail) => { setDayModalDate(dateStr); setDayModalAvailableByWeekday(isAvail); setDayModalWholeDay(false); setDayModalSlots([{ start: "15:00", end: "18:00" }]); setDayModalOpen(true); }}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                </div>
                <Dialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>
                        {dayModalAvailableByWeekday
                          ? (t.createPro.unavailabilityFor ?? "Unavailability for").replace("{date}", dayModalDate)
                          : (t.createPro.availableOnDate ?? "Available on this day?").replace("{date}", dayModalDate)}
                      </DialogTitle>
                    </DialogHeader>
                    {dayModalAvailableByWeekday ? (
                      <div className="space-y-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={dayModalWholeDay} onChange={(e) => setDayModalWholeDay(e.target.checked)} />
                          <span className="text-sm">{t.createPro.wholeDayUnavailable ?? "Whole day unavailable"}</span>
                        </label>
                        {!dayModalWholeDay && (
                          <div>
                            <p className="text-sm font-medium mb-2">{t.createPro.unavailableTimeSlots ?? "Unavailable time slots (from – to)"}</p>
                            {dayModalSlots.map((slot, i) => (
                              <div key={i} className="flex items-center gap-2 mb-2">
                                <input type="time" value={slot.start} onChange={(e) => setDayModalSlots((s) => s.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className="rounded border px-2 py-1 text-sm" />
                                <span className="text-muted-foreground">–</span>
                                <input type="time" value={slot.end} onChange={(e) => setDayModalSlots((s) => s.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} className="rounded border px-2 py-1 text-sm" />
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDayModalSlots((s) => s.filter((_, j) => j !== i))}><X size={14} /></Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setDayModalSlots((s) => [...s, { start: "19:00", end: "21:00" }])}>
                              <Plus size={14} /> {t.createPro.addSlot ?? "Add slot"}
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setDayModalOpen(false)}>{t.common.cancel ?? "Cancel"}</Button>
                          <Button onClick={() => {
                            if (dayModalWholeDay) {
                              setUnavailableDates((u) => ({ ...u, [dayModalDate]: true }));
                            } else {
                              const valid = dayModalSlots.filter((s) => s.start && s.end);
                              setUnavailableDates((u) => ({ ...u, [dayModalDate]: valid.length ? valid : true }));
                            }
                            setAvailableDateOverrides((a) => a.filter((d) => d !== dayModalDate));
                            setDayModalOpen(false);
                          }}>{t.common.save ?? "Save"}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setDayModalOpen(false)}>{t.common.cancel ?? "Cancel"}</Button>
                        <Button onClick={() => {
                          setAvailableDateOverrides((a) => a.includes(dayModalDate) ? a : [...a, dayModalDate]);
                          setUnavailableDates((u) => { const next = { ...u }; delete next[dayModalDate]; return next; });
                          setDayModalOpen(false);
                        }}>{t.createPro.markAvailable ?? "Mark as available"}</Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>

          <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <Label className="text-base font-semibold">{t.createPro.pageAesthetic ?? "Personalize your page"}</Label>
            <p className="text-sm text-muted-foreground">{t.createPro.pageAestheticHint ?? "Choose a template and colors so your public profile looks unique to clients."}</p>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{t.dashboard?.serviceTags ?? "Service tags"}</p>
              <p className="text-xs text-muted-foreground mb-2">{t.dashboard?.serviceTagsHint ?? "e.g. Emergency Repair, Commercial Work."}</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TAG_OPTIONS.map((tag) => (
                  <label key={tag} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={proServiceTags.includes(tag)}
                      onChange={(e) => {
                        if (e.target.checked) setProServiceTags((prev) => [...prev, tag]);
                        else setProServiceTags((prev) => prev.filter((x) => x !== tag));
                      }}
                      className="rounded border-input"
                    />
                    <span className="text-sm text-foreground">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">{t.createPro.colorSchemeLabel ?? "Color scheme"}</p>
              <p className="text-xs text-muted-foreground mb-2">{t.createPro.colorSchemeHint ?? "Pick a palette. Preview updates immediately."}</p>
              <select
                value={pageColorSchemeId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPageColorSchemeId(id);
                  const scheme = getSchemeById(id);
                  if (scheme) {
                    setPagePrimaryColor(scheme.primary);
                    setPageSecondaryColor(scheme.secondary);
                    setPageAccentColor(scheme.accent);
                    setPageBackgroundColor(scheme.background);
                  }
                }}
                className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              >
                {PRO_PAGE_COLOR_SCHEMES.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {(t.createPro as Record<string, string>)[`scheme${scheme.id.charAt(0).toUpperCase()}${scheme.id.slice(1)}`] ?? scheme.id}
                  </option>
                ))}
              </select>
            </div>
            {/* Phone preview of template + scheme */}
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">{t.createPro.colorSchemeLabel ?? "Color scheme"} — preview</p>
              <ProPagePhonePreview
                template="classic"
                primaryColor={pagePrimaryColor}
                secondaryColor={pageSecondaryColor}
                accentColor={pageAccentColor}
                backgroundColor={pageBackgroundColor}
                businessName={form.firstNameOrBusiness || "Your business"}
                fullName=""
                ratingLabel="5.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="certifications">{t.createPro.certifications}</Label>
            <Input
              id="certifications"
              value={form.certifications}
              onChange={(e) => setForm((p) => ({ ...p, certifications: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.insurance}</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="insurance"
                  checked={form.insurance}
                  onChange={() => setForm((p) => ({ ...p, insurance: true }))}
                />
                {t.createPro.insuranceYes}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="insurance"
                  checked={!form.insurance}
                  onChange={() => setForm((p) => ({ ...p, insurance: false }))}
                />
                {t.createPro.insuranceNo}
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.languages}</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.languagesSpoken.map(({ code, level }) => {
                const lang = CANADIAN_LANGUAGES.find((l) => l.code === code);
                const name = locale === "fr" ? lang?.nameFr : lang?.nameEn;
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-sm"
                  >
                    {name} ({levelLabel(level)})
                    <button type="button" onClick={() => removeLanguage(code)} className="text-destructive">
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="add-lang-select"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                defaultValue=""
              >
                <option value="">— {t.createPro.addLanguage} —</option>
                {CANADIAN_LANGUAGES.filter((l) => !form.languagesSpoken.some((s) => s.code === l.code)).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {locale === "fr" ? lang.nameFr : lang.nameEn}
                  </option>
                ))}
              </select>
              <select
                id="add-lang-level"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="basic">{t.createPro.languageLevelBasic}</option>
                <option value="conversational">{t.createPro.languageLevelConversational}</option>
                <option value="fluent">{t.createPro.languageLevelFluent}</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const sel = document.getElementById("add-lang-select") as HTMLSelectElement;
                  const levelSel = document.getElementById("add-lang-level") as HTMLSelectElement;
                  const code = sel?.value;
                  if (code) {
                    addLanguage(code, (levelSel?.value as LanguageLevel) || "fluent");
                    sel.value = "";
                  }
                }}
              >
                {t.createPro.add}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.workPhotosRequired}</Label>
            <input
              ref={beforeAfterInputRef}
              type="file"
              accept={ACCEPT_IMAGES}
              multiple
              className="hidden"
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  beforeAfterFiles: [...p.beforeAfterFiles, ...Array.from(e.target.files ?? [])],
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => beforeAfterInputRef.current?.click()}
            >
              <Upload size={16} /> {t.createPro.addPhotos}
            </Button>
            {form.beforeAfterFiles.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {form.beforeAfterFiles.map((f, i) => (
                  <li key={i}>
                    {f.name}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          beforeAfterFiles: p.beforeAfterFiles.filter((_, j) => j !== i),
                        }))
                      }
                      className="ml-1 text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4">
            <TermsAcceptance
              variant="pro"
              accepted={termsAccepted}
              onAcceptedChange={setTermsAccepted}
            />
          </div>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 size={18} className="animate-spin" />}
            {t.createPro.submit}
          </Button>
        </form>
      </div>
      </div>
    </Layout>
  );
}
