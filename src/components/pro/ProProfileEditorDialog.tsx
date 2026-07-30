import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/animate-ui/components/radix/dialog";
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
import { getServiceName } from "@/i18n/serviceTranslations";
import WeekdayAvailability, {
  defaultAvailability,
  availabilityToStorage,
  type AvailabilityState,
} from "@/components/WeekdayAvailability";
import { useLoadExistingProProfile } from "@/hooks/useLoadExistingProProfile";
import { legacyServiceAtWorkspaceOnly, proMapLocationMode } from "@/lib/serviceLocationMode";
import { formatCanadianPhone, phoneDigits } from "@/lib/canadianPhone";
import { formatCanadianPostal, normalizeCanadianPostal } from "@/lib/canadianPostal";
import { geocodePostalToLocation } from "@/lib/geocode";
import { buildProProfileApprovalSnapshot } from "@/lib/proProfileApprovalSnapshot";
import AvailabilityCalendar, { type UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import { getUnavailableNote, getUnavailableSlots, isWholeDayUnavailable, type UnavailableDayStored } from "@/lib/unavailableDates";
import { defaultProAvatarDataUrl, dataUrlToPngFile } from "@/lib/defaultProAvatar";
import MobileColorPreviewStage from "@/components/color-preview/MobileColorPreviewStage";
import ProPagePhonePreview from "@/components/pro/ProPagePhonePreview";
import ProServiceAreaMap, { type ServiceAreaValue } from "@/components/ProServiceAreaMap";
import {
  Dialog as DayDialog,
  DialogContent as DayDialogContent,
  DialogHeader as DayDialogHeader,
  DialogTitle as DayDialogTitle,
} from "@/components/ui/dialog";
import AddressInput, { hasGoogleAddressAutocomplete } from "@/components/AddressInput";
import { Loader2, Upload, X, Plus } from "lucide-react";
import { activatePendingGrowthTrial } from "@/lib/trialCheckout";
import { referralInvite } from "@/lib/referralInvite";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import { getProPublicContactBlacklistReasons } from "@/lib/proPublicContactBlacklist";
import { cn } from "@/lib/utils";

const STORAGE_BUCKET = "pro-photos";
const MAX_BIO_WORDS = 300;
const ACCEPT_IMAGES = "image/png,image/jpeg,image/jpg";

/** All distinct services in a category (flattened across subcategories). */
function listServicesForPrimaryCategory(categorySlug: string): { slug: string; name: string }[] {
  const cat = serviceCategories.find((c) => c.slug === categorySlug);
  if (!cat) return [];
  const bySlug = new Map<string, { slug: string; name: string }>();
  for (const sub of cat.subcategories) {
    for (const svc of sub.services) {
      if (!bySlug.has(svc.slug)) bySlug.set(svc.slug, svc);
    }
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isMissingServiceTagsColumn(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : err && typeof err === "object" && "details" in err
        ? String((err as { details?: string }).details ?? "")
        : String(err);
  return /service_tags/i.test(msg) && /schema cache|column|could not find|PGRST204/i.test(msg);
}

function omitServiceTags<T extends Record<string, unknown>>(payload: T): Omit<T, "service_tags"> & Record<string, unknown> {
  const { service_tags: _st, ...rest } = payload;
  return rest as Omit<T, "service_tags"> & Record<string, unknown>;
}

function isMissingPrivateDocColumns(err: unknown): boolean {
  const msg =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message)
      : err && typeof err === "object" && "details" in err
        ? String((err as { details?: string }).details ?? "")
        : String(err);
  return /personal_photo_url|id_document_url/i.test(msg) && /schema cache|column|could not find|PGRST204/i.test(msg);
}

function omitPrivateDocFields<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const { personal_photo_url: _p, id_document_url: _i, ...rest } = payload;
  return rest;
}

export type ProProfileEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** When true, new profiles can be created without ?onboarding=1 (Join Pros flow). */
  allowDirectCreate?: boolean;
};

export function ProProfileEditorDialog({
  open,
  onOpenChange,
  onSaved,
  allowDirectCreate = false,
}: ProProfileEditorDialogProps) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [dayModalNote, setDayModalNote] = useState("");
  const profileInputRef = useRef<HTMLInputElement>(null);
  const beforeAfterInputRef = useRef<HTMLInputElement>(null);
  const personalPhotoInputRef = useRef<HTMLInputElement>(null);
  const idDocumentInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstNameOrBusiness: "",
    legalBusinessName: "",
    businessAddress: "",
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
  const [offersWorkspace, setOffersWorkspace] = useState(true);
  const [offersTravel, setOffersTravel] = useState(false);
  const [serviceAreaValue, setServiceAreaValue] = useState<ServiceAreaValue>({
    latitude: null,
    longitude: null,
    service_radius_km: 25,
    location: null,
  });
  /** Single core category (e.g. only Business Services); all subservices must belong here. */
  const [primaryCategorySlug, setPrimaryCategorySlug] = useState("");
  const [serviceDetails, setServiceDetails] = useState<Record<string, { displayName: string; about: string }>>({});
  const [pageTemplate, setPageTemplate] = useState<string>("classic");
  const [pageColorSchemeId, setPageColorSchemeId] = useState<string>("navyTeal");
  const [pagePrimaryColor, setPagePrimaryColor] = useState("#1e3a5f");
  const [pageSecondaryColor, setPageSecondaryColor] = useState("#0d9488");
  const [pageAccentColor, setPageAccentColor] = useState("#e0f2f1");
  const [pageBackgroundColor, setPageBackgroundColor] = useState("#f8fafc");
  const [pageHeaderText, setPageHeaderText] = useState("");
  const [proServiceTags, setProServiceTags] = useState<string[]>([]);
  const { accountFields, setAccountFields, loaded: profileDataLoaded, hasExistingProfile, proEdit } =
    useLoadExistingProProfile(user?.id, !!user);
  const [profileApplied, setProfileApplied] = useState(false);
  const [existingPersonalPhotoUrl, setExistingPersonalPhotoUrl] = useState<string | null>(null);
  const [existingIdDocumentUrl, setExistingIdDocumentUrl] = useState<string | null>(null);
  const [existingGalleryUrls, setExistingGalleryUrls] = useState<string[]>([]);
  const [isProVerified, setIsProVerified] = useState(false);
  const onboarding = searchParams.get("onboarding") === "1";
  const isEditMode = hasExistingProfile;
  const promoCode = (searchParams.get("promo_code") ?? "").trim();
  const trialTokenFromPromo = (searchParams.get("trial_token") ?? "").trim();

  const wordCount = form.shortBio.trim() ? form.shortBio.trim().split(/\s+/).length : 0;
  const bioOverLimit = wordCount > MAX_BIO_WORDS;

  const onboardingMissing = !onboarding;
  useEffect(() => {
    if (!proEdit || profileApplied) return;
    setForm((prev) => ({ ...prev, ...proEdit.formPatch }));
    setServiceDetails(proEdit.serviceDetails);
    setPrimaryCategorySlug(proEdit.primaryCategorySlug);
    setOffersWorkspace(proEdit.offersWorkspace);
    setOffersTravel(proEdit.offersTravel);
    setServiceAreaValue(proEdit.serviceAreaValue);
    setUnavailableDates(proEdit.unavailableDates);
    setAvailableDateOverrides(proEdit.availableDateOverrides);
    setAvailabilityNotYet(proEdit.availabilityNotYet);
    setProServiceTags(proEdit.proServiceTags);
    setPagePrimaryColor(proEdit.pagePrimaryColor);
    setPageSecondaryColor(proEdit.pageSecondaryColor);
    setPageAccentColor(proEdit.pageAccentColor);
    setPageBackgroundColor(proEdit.pageBackgroundColor);
    setExistingPersonalPhotoUrl(proEdit.existingPersonalPhotoUrl);
    setExistingIdDocumentUrl(proEdit.existingIdDocumentUrl);
    setExistingGalleryUrls(proEdit.existingGalleryUrls);
    setIsProVerified(proEdit.isVerified);
    setProfileApplied(true);
  }, [proEdit, profileApplied]);

  useEffect(() => {
    if (open) return;
    setProfileApplied(false);
  }, [open]);

  const onboardingMissingForNew =
    profileDataLoaded && !hasExistingProfile && onboardingMissing && !allowDirectCreate;
  useEffect(() => {
    if (!onboardingMissingForNew || !open) return;
    navigateWithViewTransition(navigate, "/pro-onboarding/start", { replace: true });
  }, [onboardingMissingForNew, navigate, open]);

  const finishAfterSave = (navigateTo?: string) => {
    onSaved?.();
    onOpenChange(false);
    if (navigateTo) navigateWithViewTransition(navigate, navigateTo);
  };

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
    if (!user) return;
    if (!termsAccepted) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.toastRequiredDesc, variant: "destructive" });
      return;
    }
    if (bioOverLimit) {
      toast({ title: t.createPro.toastBioTooLong, description: t.createPro.toastBioTooLongDesc.replace("{max}", String(MAX_BIO_WORDS)), variant: "destructive" });
      return;
    }
    if (getProPublicContactBlacklistReasons(form.shortBio.trim()).length > 0) {
      toast({
        title: t.createPro.publicContactBlockedTitle ?? "Cannot submit",
        description: t.createPro.publicContactBlockedDesc ?? "",
        variant: "destructive",
      });
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
    if (!primaryCategorySlug) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.mainCategoryRequired ?? "Choose one main service category.", variant: "destructive" });
      return;
    }
    if (form.selectedServices.length === 0) {
      toast({
        title: t.createPro.toastRequired,
        description: t.createPro.selectAtLeastOneService ?? "Select at least one service.",
        variant: "destructive",
      });
      return;
    }
    const offCategory = form.selectedServices.some((k) => !k.startsWith(`${primaryCategorySlug}/`));
    if (offCategory) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.mainCategoryRequired ?? "All services must be under your main category.", variant: "destructive" });
      return;
    }
    if (!form.serviceAreas.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.serviceAreas + " is required.", variant: "destructive" });
      return;
    }
    if (!form.businessAddress.trim() || form.businessAddress.trim().length < 8) {
      toast({
        title: t.createPro.toastRequired,
        description: t.createPro.toastBusinessAddressRequired,
        variant: "destructive",
      });
      return;
    }
    if (!form.startingPrice.trim()) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.startingPrice + " is required.", variant: "destructive" });
      return;
    }
    const phoneNorm = formatCanadianPhone(accountFields.phone);
    if (phoneDigits(phoneNorm).length < 10) {
      toast({
        title: t.createPro.toastRequired,
        description: t.dashboard?.accountPhone ?? "Phone",
        variant: "destructive",
      });
      return;
    }
    const postalNorm = normalizeCanadianPostal(accountFields.postal_code);
    const invoiceAddress = form.businessAddress.trim();
    if (postalNorm.length > 0) {
      const geo = await geocodePostalToLocation(postalNorm);
      if (!geo) {
        toast({
          title: t.createPro.toastRequired,
          description: t.dashboard?.accountPostalInvalid ?? "Invalid postal code.",
          variant: "destructive",
        });
        return;
      }
    }
    if (!form.personalPhotoFile && !existingPersonalPhotoUrl) {
      toast({ title: t.createPro.toastRequired, description: t.createPro.personalPhotoLabel, variant: "destructive" });
      return;
    }
    if (!form.idDocumentFile && !existingIdDocumentUrl) {
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

      const birthdaySave = accountFields.birthday.trim() || null;
      const { error: profileAccountErr } = await supabase
        .from("profiles")
        .update({
          full_name: accountFields.full_name.trim() || form.firstNameOrBusiness.trim() || null,
          phone: phoneNorm || null,
          birthday: birthdaySave,
          email_language: accountFields.email_language,
          postal_code: postalNorm || null,
          address: invoiceAddress || null,
        })
        .eq("user_id", user.id);
      if (profileAccountErr) throw profileAccountErr;

      const { data: existing } = await supabase
        .from("pro_profiles")
        .select("id, is_verified, approval_baseline_json")
        .eq("user_id", user.id)
        .maybeSingle();
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
      const payload: Record<string, unknown> = {
        business_name: form.firstNameOrBusiness || "My Business",
        legal_business_name: form.legalBusinessName.trim() || null,
        business_address: invoiceAddress,
        bio: bioWithLanguages.slice(0, 5000),
        years_experience: form.yearsExperience,
        location: locationDisplay,
        latitude: serviceAreaValue.latitude,
        longitude: serviceAreaValue.longitude,
        service_at_workspace_only: legacyServiceAtWorkspaceOnly(offersWorkspace, offersTravel),
        offers_workspace: offersWorkspace,
        offers_travel: offersTravel,
        service_radius_km: offersTravel ? serviceAreaValue.service_radius_km : null,
        availability: availabilityStr,
        price_min: priceMin,
        phone: phoneNorm || null,
        email_language: accountFields.email_language,
        profile_last_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (personalPhotoUrl) payload.personal_photo_url = personalPhotoUrl;
      else if (existingPersonalPhotoUrl) payload.personal_photo_url = existingPersonalPhotoUrl;
      if (idDocumentUrl) payload.id_document_url = idDocumentUrl;
      else if (existingIdDocumentUrl) payload.id_document_url = existingIdDocumentUrl;
      if (Object.keys(unavailableDates).length > 0 || availableDateOverrides.length > 0) {
        payload.unavailable_dates = unavailableDates;
        payload.available_date_overrides = availableDateOverrides;
      }
      payload.primary_category_slug = primaryCategorySlug;
      payload.page_template = null;
      payload.page_primary_color = pagePrimaryColor || null;
      payload.page_secondary_color = pageSecondaryColor || null;
      payload.page_accent_color = pageAccentColor || null;
      payload.page_background_color = pageBackgroundColor || null;
      payload.page_header_text = null;
      payload.service_tags = proServiceTags.length > 0 ? proServiceTags : null;

      if (existing?.id) {
        let upErr = (await supabase.from("pro_profiles").update(payload).eq("id", existing.id)).error;
        if (upErr && isMissingServiceTagsColumn(upErr)) {
          upErr = (await supabase.from("pro_profiles").update(omitServiceTags(payload)).eq("id", existing.id)).error;
        }
        if (upErr && isMissingPrivateDocColumns(upErr)) {
          upErr = (await supabase.from("pro_profiles").update(omitPrivateDocFields(payload)).eq("id", existing.id)).error;
        }
        if (upErr) throw upErr;
        await supabase.from("pro_services").delete().eq("pro_profile_id", existing.id);
      } else {
        const { updated_at: _, ...insertPayload } = payload;
        const row = {
          ...insertPayload,
          user_id: user.id,
          is_verified: false,
        };
        let { data: newPro, error: proError } = await supabase.from("pro_profiles").insert(row).select("id").single();
        if (proError && isMissingServiceTagsColumn(proError)) {
          ({ data: newPro, error: proError } = await supabase
            .from("pro_profiles")
            .insert(omitServiceTags(row))
            .select("id")
            .single());
        }
        if (proError && isMissingPrivateDocColumns(proError)) {
          ({ data: newPro, error: proError } = await supabase
            .from("pro_profiles")
            .insert(omitPrivateDocFields(row))
            .select("id")
            .single());
        }
        if (proError) throw proError;
        if (!newPro?.id) throw new Error("Failed to create profile");
        profileId = newPro.id;
      }

      if (!profileId) throw new Error("Pro profile not found");

      const serviceRows = form.selectedServices
        .map((key) => {
          const [categorySlug, serviceSlug] = key.split("/");
          if (!categorySlug || !serviceSlug) return null;
          const d = serviceDetails[key] ?? { displayName: "", about: "" };
          return {
            pro_profile_id: profileId,
            category_slug: categorySlug,
            service_slug: serviceSlug,
            display_name: d.displayName.trim() || null,
            description: d.about.trim() || null,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r != null);
      if (serviceRows.length > 0) {
        const { error: se } = await supabase.from("pro_services").insert(serviceRows);
        if (se) throw se;
      }

      const approvalSnapshot = buildProProfileApprovalSnapshot({
        business_name: form.firstNameOrBusiness || "My Business",
        legal_business_name: form.legalBusinessName.trim() || null,
        business_address: invoiceAddress,
        bio: bioWithLanguages.slice(0, 5000),
        years_experience: form.yearsExperience,
        location: locationDisplay,
        service_at_workspace_only: legacyServiceAtWorkspaceOnly(offersWorkspace, offersTravel),
        offers_workspace: offersWorkspace,
        offers_travel: offersTravel,
        service_radius_km: offersTravel ? serviceAreaValue.service_radius_km : null,
        price_min: priceMin,
        primary_category_slug: primaryCategorySlug,
        availability: availabilityStr,
        account: {
          full_name: accountFields.full_name.trim() || form.firstNameOrBusiness.trim() || null,
          phone: phoneNorm || null,
          postal_code: postalNorm || null,
          address: invoiceAddress || null,
          birthday: birthdaySave,
          email_language: accountFields.email_language,
        },
        services: serviceRows.map((r) => ({
          category_slug: r.category_slug,
          service_slug: r.service_slug,
          display_name: r.display_name,
          description: r.description,
        })),
        languages_spoken: form.languagesSpoken.map((l) => ({ code: l.code, level: l.level })),
      });

      if (!existing?.is_verified) {
        const baseline = (existing as { approval_baseline_json?: unknown } | null)?.approval_baseline_json;
        if (!baseline) {
          const { error: snapErr } = await supabase
            .from("pro_profiles")
            .update({ approval_baseline_json: approvalSnapshot })
            .eq("id", profileId);
          if (snapErr && !/approval_baseline_json/i.test(snapErr.message ?? "")) throw snapErr;
        }
      }

      {
        let file: File;
        if (form.profilePhotoFile) {
          file = form.profilePhotoFile;
        } else {
          const dataUrl = defaultProAvatarDataUrl(form.firstNameOrBusiness || "Pro", pagePrimaryColor);
          file = await dataUrlToPngFile(dataUrl, `profile-default-${Date.now()}.png`);
        }
        const path = `${user.id}/profile-${Date.now()}.${file.name.split(".").pop() || "png"}`;
        const url = await uploadFile(path, file);
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

      if (promoCode) {
        const { data: promoData, error: promoError } = await referralInvite("redeem_code", { code: promoCode });
        if (promoError) throw promoError;
        if (promoData?.trial_ends_at) {
          const d = new Date(promoData.trial_ends_at).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" });
          toast({
            title: t.createPro.promoOfferAppliedTitle ?? "Promotional offer applied",
            description: (t.createPro.promoOfferAppliedUntil ?? "Your plan now includes promotional access until {{date}}.").replace("{{date}}", d),
          });
        }
      }

      if (trialTokenFromPromo) {
        toast({
          title: t.createPro.personalTrialContinueTitle ?? "Continue your Growth trial",
          description: t.createPro.personalTrialContinueDesc ?? "Next, add a payment method to activate your 2-month trial.",
        });
        navigateWithViewTransition(
          navigate,
          `/pro-plans/trial?token=${encodeURIComponent(trialTokenFromPromo)}`,
        );
        onOpenChange(false);
        return;
      }

      if (searchParams.get("trial") === "pending") {
        const { data: trialData, error: trialError } = await activatePendingGrowthTrial();
        if (trialError) throw trialError;
        const trialDate =
          trialData?.trial_ends_at != null
            ? new Date(trialData.trial_ends_at).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long" })
            : "";
        toast({
          title: t.createPro.growthTrialActivatedTitle ?? "Growth trial activated",
          description: trialData?.trial_ends_at
            ? (t.createPro.growthTrialActivatedUntil ?? "Your trial runs until {{date}}.").replace("{{date}}", trialDate)
            : (t.createPro.growthTrialActivatedShort ?? "Your Growth trial is now active."),
        });
        finishAfterSave("/pro-plans");
      } else if (isEditMode && !isProVerified) {
        toast({
          title: locale === "fr" ? "Profil enregistré" : "Profile saved",
          description:
            locale === "fr"
              ? "Vos modifications sont enregistrées. L'équipe verra la version mise à jour lors de l'approbation."
              : "Your changes are saved. Our team will review the updated application.",
        });
        finishAfterSave();
      } else {
        toast({
          title: t.createPro.toastSuccessTitle,
          description: (onboarding ? (t.createPro.onboardingPostSubmitHint ?? "") : t.createPro.toastSuccessDesc).trim(),
        });
        finishAfterSave(isEditMode ? undefined : "/pro-plans?onboarding=1");
      }
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

  const catalogLabelForKey = (key: string) => {
    const [cs, ss] = key.split("/");
    if (!cs || !ss) return "";
    const cat = serviceCategories.find((c) => c.slug === cs);
    for (const sub of cat?.subcategories ?? []) {
      const svc = sub.services.find((s) => s.slug === ss);
      if (svc) return getServiceName(svc.slug, locale, svc.name);
    }
    return ss.replace(/-/g, " ");
  };

  const toggleService = (key: string) => {
    if (!primaryCategorySlug || !key.startsWith(`${primaryCategorySlug}/`)) return;
    setForm((prev) => {
      const has = prev.selectedServices.includes(key);
      if (has) {
        setServiceDetails((d) => {
          const next = { ...d };
          delete next[key];
          return next;
        });
        return { ...prev, selectedServices: prev.selectedServices.filter((s) => s !== key) };
      }
      const initial = catalogLabelForKey(key);
      setServiceDetails((d) => ({ ...d, [key]: d[key] ?? { displayName: initial, about: "" } }));
      return { ...prev, selectedServices: [...prev.selectedServices, key] };
    });
  };

  const addLanguage = (code: string, level: LanguageLevel) => {
    if (form.languagesSpoken.some((l) => l.code === code)) return;
    setForm((prev) => ({ ...prev, languagesSpoken: [...prev.languagesSpoken, { code, level }] }));
  };
  const removeLanguage = (code: string) => {
    setForm((prev) => ({ ...prev, languagesSpoken: prev.languagesSpoken.filter((l) => l.code !== code) }));
  };

  const openUnavailableDayModal = (dateStr: string, isAvail: boolean) => {
    setDayModalDate(dateStr);
    setDayModalAvailableByWeekday(isAvail);
    setDayModalNote(getUnavailableNote(unavailableDates[dateStr] as UnavailableDayStored) ?? "");
    const raw = unavailableDates[dateStr] as UnavailableDayStored | undefined;
    if (isWholeDayUnavailable(raw)) {
      setDayModalWholeDay(true);
      setDayModalSlots([{ start: "15:00", end: "18:00" }]);
    } else {
      const slots = Array.isArray(raw) ? raw : getUnavailableSlots(raw);
      setDayModalWholeDay(false);
      setDayModalSlots(slots.length ? slots : [{ start: "15:00", end: "18:00" }]);
    }
    setDayModalOpen(true);
  };

  return (
    <>
      <Dialog open={open && Boolean(user)} onOpenChange={onOpenChange}>
        <DialogContent
          from="bottom"
          showCloseButton
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            "sm:max-w-3xl w-[calc(100%-1.5rem)] max-h-[min(92vh,920px)]",
            "rounded-2xl sm:rounded-3xl border-border/40 shadow-2xl",
          )}
        >
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/50 bg-muted/20 px-5 py-5 sm:px-6 sm:py-6 text-left">
            <DialogTitle className="font-heading text-xl sm:text-2xl font-bold tracking-tight">
              {isEditMode ? (t.joinPros.editProfile ?? "Edit Pro Profile") : t.createPro.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {isEditMode
                ? locale === "fr"
                  ? "Modifiez les informations soumises pour approbation, puis enregistrez."
                  : "Update the details you submitted for approval, then save."
                : t.createPro.subtitle}
            </DialogDescription>
          </DialogHeader>

          {!profileDataLoaded || onboardingMissingForNew ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-90" aria-hidden />
              <p className="text-sm text-muted-foreground text-center">
                {locale === "fr" ? "Chargement…" : "Loading…"}
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6",
                  "[&_section]:rounded-2xl [&_section]:border-border/50 [&_section]:shadow-sm",
                  "[&_.rounded-lg]:rounded-2xl",
                )}
              >
                {onboarding ? (
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-muted-foreground mb-4">
                    <p className="font-medium text-foreground mb-1">{t.createPro.onboardingBannerTitle}</p>
                    <p>{t.createPro.onboardingBannerBody}</p>
                  </div>
                ) : null}

                <form id="pro-profile-editor-form" onSubmit={handleSubmit} className="space-y-6 md:space-y-8 pb-2">
          <section className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-foreground dark:text-white">{t.dashboard?.accountDetailsTitle ?? "Account details"}</h2>
              <p className="text-xs text-muted-foreground dark:text-white/75 mt-1">
                {locale === "fr"
                  ? "Utilisé pour le tableau de bord, les pages d'accueil et les reçus."
                  : "Used to prefill the home and Services pages and for receipts."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-full-name">{t.dashboard?.accountName ?? "Name"}</Label>
              <Input
                id="acc-full-name"
                value={accountFields.full_name}
                onChange={(e) => setAccountFields((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Ryan Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-phone">{t.dashboard?.accountPhone ?? "Phone"} *</Label>
              <Input
                id="acc-phone"
                type="tel"
                value={accountFields.phone}
                onChange={(e) => setAccountFields((p) => ({ ...p, phone: formatCanadianPhone(e.target.value) }))}
                placeholder="(450) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-postal">{t.dashboard?.accountPostalCode ?? "Postal code"}</Label>
              <Input
                id="acc-postal"
                value={accountFields.postal_code}
                onChange={(e) => setAccountFields((p) => ({ ...p, postal_code: formatCanadianPostal(e.target.value) }))}
                placeholder="A1B 2C3"
                maxLength={7}
                className="font-mono uppercase tracking-wide"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.auth?.emailLanguageLabel ?? "Preferred language"}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={accountFields.email_language === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAccountFields((p) => ({ ...p, email_language: "en" }))}
                >
                  English
                </Button>
                <Button
                  type="button"
                  variant={accountFields.email_language === "fr" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAccountFields((p) => ({ ...p, email_language: "fr" }))}
                >
                  Français
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="acc-birthday">{t.dashboard?.accountBirthday ?? "Birthday"}</Label>
              <Input
                id="acc-birthday"
                type="date"
                value={accountFields.birthday}
                onChange={(e) => setAccountFields((p) => ({ ...p, birthday: e.target.value }))}
              />
            </div>
          </section>

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
            <Label htmlFor="legalBusinessName">{t.createPro.legalBusinessNameOptional}</Label>
            <Input
              id="legalBusinessName"
              value={form.legalBusinessName}
              onChange={(e) => setForm((p) => ({ ...p, legalBusinessName: e.target.value }))}
              placeholder={t.createPro.legalBusinessNameHint}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">{t.createPro.legalBusinessNameHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAddress">{t.createPro.businessAddressInvoiceLabel} *</Label>
            <AddressInput
              id="businessAddress"
              value={form.businessAddress}
              onChange={(v) => setForm((p) => ({ ...p, businessAddress: v }))}
              className="w-full"
              required
              placeholder="123 Rue Example, Montréal, QC H2X 1Y2"
              textareaRows={3}
            />
            {!hasGoogleAddressAutocomplete() ? (
              <p className="text-xs text-muted-foreground">{t.terms.bookingAddressNoPlaces}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">{t.createPro.businessAddressInvoiceHint}</p>
            <p className="text-xs text-muted-foreground">
              {locale === "fr"
                ? "Cette adresse est aussi enregistrée dans Mon compte → Adresse pour les reçus."
                : "This address is also saved to My account → Address for receipts."}
            </p>
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
              <option value="">-</option>
              {YEARS_EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === "fr" ? opt.labelFr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.serviceCategories} *</Label>
            <p className="text-xs text-muted-foreground mb-2">{t.createPro.mainCategoryHelp ?? "Choose the one main area you work in (e.g. Business Services). Then pick subservices and add a custom name and description for your public page."}</p>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
                  value={primaryCategorySlug}
                  onChange={(e) => {
                    setPrimaryCategorySlug(e.target.value);
                    setForm((p) => ({ ...p, selectedServices: [] }));
                    setServiceDetails({});
                  }}
                >
                  <option value="">{t.createPro.mainCategorySelect ?? t.createPro.selectCategory}</option>
                  {serviceCategories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {getCategoryName(cat, locale)}
                    </option>
                  ))}
                </select>
              </div>
              {primaryCategorySlug ? (
                <div className="border rounded-lg p-3 bg-muted/20 max-h-56 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t.createPro.checkServices}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {listServicesForPrimaryCategory(primaryCategorySlug).map((svc) => {
                      const key = `${primaryCategorySlug}/${svc.slug}`;
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
              ) : null}
              {form.selectedServices.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {form.selectedServices.length} {t.createPro.servicesSelected}
                  </p>
                  <div className="space-y-4 mt-3">
                    {form.selectedServices
                      .slice()
                      .sort()
                      .map((key) => (
                        <div key={key} className="rounded-lg border border-border p-3 space-y-2 bg-card">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t.createPro.subserviceFromCatalog ?? "Subservice"}: {catalogLabelForKey(key)}
                          </p>
                          <div className="space-y-1">
                            <Label htmlFor={`dn-${key}`} className="text-sm">{t.createPro.personalizedServiceName ?? "Service name"}</Label>
                            <Input
                              id={`dn-${key}`}
                              value={serviceDetails[key]?.displayName ?? ""}
                              onChange={(e) =>
                                setServiceDetails((d) => ({
                                  ...d,
                                  [key]: { ...(d[key] ?? { displayName: "", about: "" }), displayName: e.target.value },
                                }))
                              }
                              placeholder={t.createPro.personalizedNamePlaceholder ?? "e.g. Phone repair"}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor={`ab-${key}`} className="text-sm">{t.createPro.serviceAboutLabel ?? "About this service"}</Label>
                            <Textarea
                              id={`ab-${key}`}
                              rows={3}
                              value={serviceDetails[key]?.about ?? ""}
                              onChange={(e) =>
                                setServiceDetails((d) => ({
                                  ...d,
                                  [key]: { ...(d[key] ?? { displayName: "", about: "" }), about: e.target.value },
                                }))
                              }
                              placeholder={t.createPro.serviceAboutPlaceholder ?? "What clients should know; shown on your pro page."}
                              className="resize-y"
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.createPro.serviceAreaMap}</Label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={offersWorkspace}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setOffersWorkspace(on);
                    if (!on && !offersTravel) setOffersTravel(true);
                  }}
                />
                <span className="text-sm">{t.createPro.serviceAtWorkspaceOnly}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={offersTravel}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setOffersTravel(on);
                    if (!on && !offersWorkspace) setOffersWorkspace(true);
                  }}
                />
                <span className="text-sm">{t.createPro.serviceTravelToClient}</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed rounded-md border border-border/60 bg-muted/15 px-3 py-2">
              {t.createPro.serviceModePrivacyNotice ?? ""}
            </p>
            {offersWorkspace && offersTravel ? (
              <p className="text-xs text-muted-foreground">{t.createPro.serviceOffersBothHint ?? ""}</p>
            ) : null}
            <ProServiceAreaMap
              value={serviceAreaValue}
              onChange={(v) => {
                setServiceAreaValue(v);
                if (v.location) setForm((p) => ({ ...p, serviceAreas: v.location ?? p.serviceAreas }));
              }}
              locationMode={proMapLocationMode(offersWorkspace, offersTravel)}
              workspaceSectionLabel={t.createPro.serviceAtWorkspaceOnly}
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
            {availabilityNotYet ? (
              <p className="text-xs text-amber-800 dark:text-amber-200 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 leading-relaxed">
                {t.createPro.availabilityNotYetWarning ??
                  "Clients cannot book you until you add a weekly schedule below or uncheck this option."}
              </p>
            ) : null}
            {!availabilityNotYet && (
              <>
                <p className="text-xs text-muted-foreground mb-1">{t.createPro.regularAvailabilityHint ?? "Set your regular weekly availability (days and timeframes). Use the calendar below for specific date exceptions."}</p>
                <WeekdayAvailability value={form.availability} onChange={(v) => setForm((p) => ({ ...p, availability: v }))} />
                <Label className="mt-3 block">{t.createPro.specificDates ?? "Specific date exceptions"}</Label>
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  {t.createPro.calendarClickHint ??
                    "Click a day to mark it unavailable (whole day or time slots) or to mark a usually-unavailable day as available."}{" "}
                  {t.createPro.calendarExternalBookingsHint ??
                    "You can also block days for off-platform jobs or mark outside bookings on those dates."}
                </p>
                <div className="grid md:grid-cols-3 gap-3 mt-1">
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={0}
                    onDayClick={(dateStr, isAvail) => openUnavailableDayModal(dateStr, isAvail)}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={1}
                    onDayClick={(dateStr, isAvail) => openUnavailableDayModal(dateStr, isAvail)}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                  <AvailabilityCalendar
                    availability={availabilityToStorage(form.availability)}
                    initialMonthOffset={2}
                    onDayClick={(dateStr, isAvail) => openUnavailableDayModal(dateStr, isAvail)}
                    unavailableDates={unavailableDates}
                    availableDateOverrides={availableDateOverrides}
                  />
                </div>
                <DayDialog open={dayModalOpen} onOpenChange={setDayModalOpen}>
                  <DayDialogContent className="max-w-md">
                    <DayDialogHeader>
                      <DayDialogTitle>
                        {dayModalAvailableByWeekday
                          ? (t.createPro.unavailabilityFor ?? "Unavailability for").replace("{date}", dayModalDate)
                          : (t.createPro.availableOnDate ?? "Available on this day?").replace("{date}", dayModalDate)}
                      </DayDialogTitle>
                    </DayDialogHeader>
                    {dayModalAvailableByWeekday ? (
                      <div className="space-y-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={dayModalWholeDay} onChange={(e) => setDayModalWholeDay(e.target.checked)} />
                          <span className="text-sm">{t.createPro.wholeDayUnavailable ?? "Whole day unavailable"}</span>
                        </label>
                        <div className="space-y-1">
                          <Label className="text-sm">{t.createPro.unavailableDayReasonLabel ?? "Reason for this day (optional)"}</Label>
                          <Input
                            value={dayModalNote}
                            onChange={(e) => setDayModalNote(e.target.value)}
                            placeholder={t.createPro.unavailableDayReasonPlaceholder ?? "e.g. Holiday, training"}
                            className="text-sm"
                          />
                        </div>
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
                            const note = dayModalNote.trim();
                            if (dayModalWholeDay) {
                              setUnavailableDates((u) => ({ ...u, [dayModalDate]: note ? { wholeDay: true, note } : true }));
                            } else {
                              const valid = dayModalSlots.filter((s) => s.start && s.end);
                              if (valid.length) {
                                const v: UnavailableDayStored = note ? { slots: valid, note } : valid;
                                setUnavailableDates((u) => ({ ...u, [dayModalDate]: v }));
                              } else {
                                setUnavailableDates((u) => ({ ...u, [dayModalDate]: note ? { wholeDay: true, note } : true }));
                              }
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
                  </DayDialogContent>
                </DayDialog>
              </>
            )}
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRO_PAGE_COLOR_SCHEMES.map((scheme) => {
                  const isSelected = pageColorSchemeId === scheme.id;
                  const label =
                    (t.createPro as Record<string, string>)[`scheme${scheme.id.charAt(0).toUpperCase()}${scheme.id.slice(1)}`] ??
                    scheme.id;
                  return (
                    <button
                      key={scheme.id}
                      type="button"
                      onClick={() => {
                        setPageColorSchemeId(scheme.id);
                        setPagePrimaryColor(scheme.primary);
                        setPageSecondaryColor(scheme.secondary);
                        setPageAccentColor(scheme.accent);
                        setPageBackgroundColor(scheme.background);
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
            {/* Phone preview: real device aspect; colors fill the glass - no decorative backdrop */}
            <div className="flex w-full flex-col items-center justify-center py-3 sm:py-5">
              <MobileColorPreviewStage
                skin="embedded"
                className="w-full max-w-full border-0 bg-transparent p-0 shadow-none"
              >
                <ProPagePhonePreview
                  withDeviceFrame
                  template={pageTemplate === "soft" || pageTemplate === "interactive" ? pageTemplate : "classic"}
                  primaryColor={pagePrimaryColor}
                  secondaryColor={pageSecondaryColor}
                  accentColor={pageAccentColor}
                  backgroundColor={pageBackgroundColor}
                  businessName={form.firstNameOrBusiness || "Your business"}
                  fullName=""
                  ratingLabel="5.0"
                />
              </MobileColorPreviewStage>
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
                <option value="">{t.createPro.addLanguage}</option>
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

          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
            <TermsAcceptance
              variant="pro"
              accepted={termsAccepted}
              onAcceptedChange={setTermsAccepted}
            />
          </div>

                </form>
              </div>

              <DialogFooter className="shrink-0 flex-row items-center justify-between gap-3 border-t border-border/50 bg-background px-5 py-4 sm:px-6 sm:py-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-full px-5">
                    {t.common.cancel}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="lg"
                  className="gap-2 min-w-[10rem] rounded-full px-6 shadow-sm"
                  disabled={loading}
                  form="pro-profile-editor-form"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  {isEditMode
                    ? locale === "fr"
                      ? "Enregistrer"
                      : "Save profile"
                    : t.createPro.submit}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProProfileEditorDialog;

