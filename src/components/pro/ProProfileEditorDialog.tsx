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
import { PRO_PAGE_COLOR_SCHEMES, DEFAULT_PRO_PAGE_COLOR_SCHEME, getSchemeById, resolveProPageScheme, schemeLabel } from "@/data/proPageColorSchemes";
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
import { resolveShareSlugChoices } from "@/lib/resolveShareSlug";
import { publicShareUrl, slugifyShareName } from "@/lib/proShareSlug";
import AddressInput, { hasGoogleAddressAutocomplete } from "@/components/AddressInput";
import BootLoadingScreen from "@/components/BootLoadingScreen";
import { Loader2, Upload, X, Plus } from "lucide-react";
import { activatePendingGrowthTrial } from "@/lib/trialCheckout";
import { referralInvite } from "@/lib/referralInvite";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import { getProPublicContactBlacklistReasons } from "@/lib/proPublicContactBlacklist";
import { cn } from "@/lib/utils";

const STORAGE_BUCKET = "pro-photos";
const VERIFICATION_BUCKET = "pro-verification";
const MAX_BIO_WORDS = 300;
const ACCEPT_IMAGES = "image/png,image/jpeg,image/jpg";
const ACCEPT_VERIFICATION_DOCS = "application/pdf,image/png,image/jpeg,image/webp";

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
  const insuranceDocumentInputRef = useRef<HTMLInputElement>(null);
  const licenseDocumentInputRef = useRef<HTMLInputElement>(null);
  const [insuranceDocumentFile, setInsuranceDocumentFile] = useState<File | null>(null);
  const [licenseDocumentFile, setLicenseDocumentFile] = useState<File | null>(null);
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState("");
  const [rbqVerification, setRbqVerification] = useState<{ status: "verified" | "needs_review"; reason?: string; official_name?: string; subcategories?: string[] } | null>(null);
  const [rbqChecking, setRbqChecking] = useState(false);

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
  const [pageColorSchemeId, setPageColorSchemeId] = useState<string>(DEFAULT_PRO_PAGE_COLOR_SCHEME.id);
  const [pagePrimaryColor, setPagePrimaryColor] = useState(DEFAULT_PRO_PAGE_COLOR_SCHEME.primary);
  const [pageSecondaryColor, setPageSecondaryColor] = useState(DEFAULT_PRO_PAGE_COLOR_SCHEME.secondary);
  const [pageAccentColor, setPageAccentColor] = useState(DEFAULT_PRO_PAGE_COLOR_SCHEME.accent);
  const [pageBackgroundColor, setPageBackgroundColor] = useState(DEFAULT_PRO_PAGE_COLOR_SCHEME.background);
  const [pageHeaderText, setPageHeaderText] = useState("");
  const [proServiceTags, setProServiceTags] = useState<string[]>([]);
  const { accountFields, setAccountFields, loaded: profileDataLoaded, hasExistingProfile, proEdit } =
    useLoadExistingProProfile(user?.id, !!user);
  const [profileApplied, setProfileApplied] = useState(false);
  const [existingPersonalPhotoUrl, setExistingPersonalPhotoUrl] = useState<string | null>(null);
  const [existingIdDocumentUrl, setExistingIdDocumentUrl] = useState<string | null>(null);
  const [existingGalleryUrls, setExistingGalleryUrls] = useState<string[]>([]);
  const [isProVerified, setIsProVerified] = useState(false);
  const [selectedShareSlug, setSelectedShareSlug] = useState("");
  const [shareSlugTaken, setShareSlugTaken] = useState(false);
  const [shareSlugAlternatives, setShareSlugAlternatives] = useState<[string, string] | null>(null);
  const [shareSlugChecking, setShareSlugChecking] = useState(false);
  /** The public link is /<account username>; the slug picker below is only for accounts without one. */
  const [accountUsername, setAccountUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("username").eq("user_id", uid).maybeSingle();
      if (!cancelled) setAccountUsername((data as { username?: string | null } | null)?.username?.trim() || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);
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
    setPageColorSchemeId(resolveProPageScheme(proEdit.pagePrimaryColor).id);
    setExistingPersonalPhotoUrl(proEdit.existingPersonalPhotoUrl);
    setExistingIdDocumentUrl(proEdit.existingIdDocumentUrl);
    setExistingGalleryUrls(proEdit.existingGalleryUrls);
    setIsProVerified(proEdit.isVerified);
    setSelectedShareSlug(proEdit.shareSlug || slugifyShareName(proEdit.formPatch.firstNameOrBusiness));
    setShareSlugTaken(false);
    setShareSlugAlternatives(null);
    setProfileApplied(true);
  }, [proEdit, profileApplied]);

  useEffect(() => {
    if (!open || accountUsername) return;
    const name = form.firstNameOrBusiness.trim();
    if (!name) {
      setSelectedShareSlug("");
      setShareSlugTaken(false);
      setShareSlugAlternatives(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setShareSlugChecking(true);
      void resolveShareSlugChoices(name, proEdit?.proProfileId).then((res) => {
        if (cancelled) return;
        setShareSlugTaken(res.taken);
        setShareSlugAlternatives(res.taken ? res.alternatives : null);
        setSelectedShareSlug((prev) => {
          if (!res.taken) return res.preferred;
          if (prev === res.alternatives[0] || prev === res.alternatives[1]) return prev;
          return res.alternatives[0];
        });
        setShareSlugChecking(false);
      });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.firstNameOrBusiness, open, proEdit?.proProfileId, accountUsername]);

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

  const uploadFile = async (path: string, file: File, bucket = STORAGE_BUCKET): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw error;
    if (bucket === VERIFICATION_BUCKET) {
      // For private verification documents, return the clean storage path, not a public URL
      return data.path;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const selectedServiceNames = form.selectedServices.map((key) => {
    const [categorySlug, serviceSlug] = key.split("/");
    const serviceName = listServicesForPrimaryCategory(categorySlug).find((service) => service.slug === serviceSlug)?.name ?? serviceSlug;
    return `${categorySlug} ${serviceName}`;
  });
  const hasPlumbingServices = selectedServiceNames.some((name) => /plumb|plomberie/i.test(name));
  const needsTradeLicense = selectedServiceNames.some((name) => /plumb|plomberie|electri|électri|hvac|cvac|heating|roofing|toiture|gas fitting|gaz/i.test(name));

  const verifyRbqLicense = async (proProfileId?: string) => {
    setRbqChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-rbq-license", {
        body: {
          license_number: tradeLicenseNumber.trim(),
          legal_name: form.legalBusinessName.trim() || form.firstNameOrBusiness.trim(),
          ...(proProfileId ? { pro_profile_id: proProfileId } : {}),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRbqVerification(data);
      return data;
    } catch (error) {
      console.error("RBQ verification failed", error);
      const unavailable = { status: "needs_review" as const, reason: "registry_unavailable" };
      setRbqVerification(unavailable);
      return unavailable;
    } finally {
      setRbqChecking(false);
    }
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
    if (needsTradeLicense && (!tradeLicenseNumber.trim() || (!hasPlumbingServices && !licenseDocumentFile) || !form.insurance || !insuranceDocumentFile)) {
      toast({
        title: t.createPro.toastRequired,
        description: locale === "fr"
          ? "Les services réglementés nécessitent le numéro de licence applicable, une preuve de licence et un certificat d’assurance pour vérification."
          : "Regulated services require the applicable licence number, licence evidence, and a certificate of insurance for review.",
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
        personalPhotoUrl = await uploadFile(path, form.personalPhotoFile, VERIFICATION_BUCKET);
      }
      if (form.idDocumentFile) {
        const path = `${user.id}/private/id-${Date.now()}.${ext(form.idDocumentFile)}`;
        idDocumentUrl = await uploadFile(path, form.idDocumentFile, VERIFICATION_BUCKET);
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
      // With a username the DB mirrors it into share_slug; only pick a slug for accounts without one.
      if (!accountUsername) payload.share_slug = selectedShareSlug || slugifyShareName(form.firstNameOrBusiness);

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

      const uploadVerificationDocument = async (file: File, type: "insurance_certificate" | "trade_license") => {
        if (file.size > 10 * 1024 * 1024) throw new Error("Verification documents must be 10 MB or smaller.");
        if (!new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]).has(file.type)) {
          throw new Error("Upload a PDF, PNG, JPEG, or WebP verification document.");
        }
        const path = `${user.id}/verification/${profileId}/${type}-${Date.now()}-${crypto.randomUUID()}.${ext(file)}`;
        const storagePath = await uploadFile(path, file, VERIFICATION_BUCKET);
        const { error } = await supabase.from("pro_verification_documents").insert({
          pro_profile_id: profileId,
          document_type: type,
          storage_path: storagePath,
          status: "pending_review",
          extracted_fields: { extraction_status: "not_configured", review_reason: "No insurer/RBQ registry integration is configured." },
        });
        if (error) throw error;
      };

      if (form.insurance && insuranceDocumentFile) {
        await uploadVerificationDocument(insuranceDocumentFile, "insurance_certificate");
      }
      if (needsTradeLicense && (licenseDocumentFile || hasPlumbingServices)) {
        const normalizedLicenseNumber = tradeLicenseNumber.trim();
        const { data: existingLicense } = await supabase
          .from("pro_licenses")
          .select("id")
          .eq("pro_profile_id", profileId)
          .eq("license_number", normalizedLicenseNumber)
          .maybeSingle();
        if (!existingLicense) {
          const { error: licenseError } = await supabase.from("pro_licenses").insert({
            pro_profile_id: profileId,
            license_number: normalizedLicenseNumber,
            license_type: hasPlumbingServices ? "RBQ" : "TRADE",
            holder_name: form.legalBusinessName.trim() || form.firstNameOrBusiness.trim(),
            is_verified: false,
            verification_data: null,
          });
          if (licenseError) throw licenseError;
        }
        if (licenseDocumentFile) await uploadVerificationDocument(licenseDocumentFile, "trade_license");
        if (hasPlumbingServices) {
          // Registry lookup runs again with the saved profile ID; the Edge Function
          // verifies ownership before persisting its trusted result.
          await verifyRbqLicense(profileId);
        }
      }

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
            <div className="flex flex-1 flex-col items-center justify-center px-2 py-6">
              <BootLoadingScreen
                fullScreen={false}
                label={locale === "fr" ? "Chargement…" : "Loading…"}
              />
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
            {accountUsername ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.dashboard.shareSlugPreview ?? "Public link preview"}
                </p>
                <p className="text-sm font-medium text-foreground break-all">{publicShareUrl(accountUsername)}</p>
                <p className="text-xs text-muted-foreground">
                  {locale === "fr"
                    ? "Votre lien suit votre nom d’utilisateur. Modifiez-le dans Mon compte → Nom d’utilisateur."
                    : "Your link follows your username. Change it under My account → Username."}
                </p>
              </div>
            ) : form.firstNameOrBusiness.trim() ? (
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t.dashboard.shareSlugPreview ?? "Public link preview"}
                  {shareSlugChecking ? "…" : ""}
                </p>
                {!shareSlugTaken ? (
                  <p className="text-sm font-medium text-foreground break-all">
                    {publicShareUrl(selectedShareSlug || slugifyShareName(form.firstNameOrBusiness))}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {t.dashboard.shareSlugTakenTitle ?? "That link is taken"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.dashboard.shareSlugTakenHint ??
                        "Pick one of these available links for your public page:"}
                    </p>
                    <div className="flex flex-col gap-2">
                      {(shareSlugAlternatives ?? []).map((alt) => (
                        <label
                          key={alt}
                          className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                        >
                          <input
                            type="radio"
                            name="share-slug-choice"
                            checked={selectedShareSlug === alt}
                            onChange={() => setSelectedShareSlug(alt)}
                          />
                          <span className="break-all font-medium">{publicShareUrl(alt)}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}
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
            <div>
              <p className="text-sm font-medium text-foreground mb-2">{t.dashboard?.serviceTags ?? "Service tags"}</p>
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
              <p className="text-sm font-medium text-foreground mb-2">{t.createPro.colorSchemeLabel ?? "Color scheme"}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRO_PAGE_COLOR_SCHEMES.map((scheme) => {
                  const isSelected = pageColorSchemeId === scheme.id;
                  const label =
                    schemeLabel(scheme, locale);
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
                        background: `linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.primary} 68%, ${scheme.secondary} 100%)`,
                                      color: scheme.ink,
                      }}
                      aria-pressed={isSelected}
                    >
                      <span className="relative z-10 flex items-center justify-between gap-2">
                        <span className="truncate">{label}</span>
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
            {form.insurance && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">
                  {locale === "fr"
                    ? "Téléversez votre certificat d’assurance (PDF ou photo). Il sera conservé de façon privée et soumis à une vérification humaine."
                    : "Upload your certificate of insurance (PDF or photo). It is stored privately and submitted for human review."}
                </p>
                <input
                  ref={insuranceDocumentInputRef}
                  type="file"
                  accept={ACCEPT_VERIFICATION_DOCS}
                  className="hidden"
                  onChange={(event) => setInsuranceDocumentFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" className="gap-2" onClick={() => insuranceDocumentInputRef.current?.click()}>
                  <Upload size={16} />
                  {insuranceDocumentFile?.name ?? (locale === "fr" ? "Ajouter le certificat" : "Add certificate")}
                </Button>
                <p className="text-xs text-muted-foreground">{locale === "fr" ? "Statut après l’envoi : À vérifier. Le téléversement ne signifie pas que l’assurance est vérifiée." : "Submission status: Needs review. Uploading does not mean insurance is verified."}</p>
              </div>
            )}
            {needsTradeLicense && (
              <div className="space-y-2 rounded-lg border border-amber-500/40 p-3">
                <Label htmlFor="trade-license-number">
                  {hasPlumbingServices
                    ? (locale === "fr" ? "Numéro de licence RBQ" : "RBQ licence number")
                    : (locale === "fr" ? "Numéro de licence professionnelle" : "Professional licence number")}
                </Label>
                <Input id="trade-license-number" value={tradeLicenseNumber} onChange={(event) => setTradeLicenseNumber(event.target.value)} placeholder={hasPlumbingServices ? "1234-5678-90" : undefined} />
                {hasPlumbingServices && (
                  <>
                    <Button type="button" variant="outline" disabled={rbqChecking || !/^\d{4}-\d{4}-\d{2}$/.test(tradeLicenseNumber.trim())} onClick={() => void verifyRbqLicense()}>
                      {rbqChecking ? (locale === "fr" ? "Vérification…" : "Checking…") : (locale === "fr" ? "Vérifier la licence RBQ" : "Verify RBQ licence")}
                    </Button>
                    {rbqVerification && (
                      <p className={`text-sm ${rbqVerification.status === "verified" ? "text-green-700" : "text-amber-700"}`} role="status">
                        {rbqVerification.status === "verified"
                          ? (locale === "fr" ? `Licence RBQ vérifiée — sous-catégories : ${rbqVerification.subcategories?.join(", ")}` : `RBQ licence verified — subcategories: ${rbqVerification.subcategories?.join(", ")}`)
                          : (locale === "fr" ? "Vérification RBQ à examiner. Les sous-catégories et l’admissibilité aux travaux seront examinées." : "RBQ verification needs review. Subcategories and job eligibility require review.")}
                      </p>
                    )}
                  </>
                )}
                <input
                  ref={licenseDocumentInputRef}
                  type="file"
                  accept={ACCEPT_VERIFICATION_DOCS}
                  className="hidden"
                  onChange={(event) => setLicenseDocumentFile(event.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" className="gap-2" onClick={() => licenseDocumentInputRef.current?.click()}>
                  <Upload size={16} />
                  {licenseDocumentFile?.name ?? (locale === "fr" ? "Ajouter une preuve de licence" : "Add licence evidence")}
                </Button>
                <p className="text-xs text-muted-foreground">{locale === "fr" ? "Le registre public confirme la licence et ses sous-catégories. L’admissibilité à chaque travail peut aussi dépendre du lieu et du travail précis." : "The public registry confirms the licence and its subcategories. Eligibility for each job may also depend on location and the specific work."}</p>
              </div>
            )}
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

