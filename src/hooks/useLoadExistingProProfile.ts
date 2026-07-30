import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { splitBioAndLanguages } from "@/lib/parseBioLanguages";
import { formatCanadianPhone } from "@/lib/canadianPhone";
import { formatCanadianPostal } from "@/lib/canadianPostal";
import { parseAvailabilityFromStorage, defaultAvailability, type AvailabilityState } from "@/components/WeekdayAvailability";
import type { UnavailableDatesMap } from "@/components/pro/AvailabilityCalendar";
import type { ServiceAreaValue } from "@/components/ProServiceAreaMap";
import type { LanguageLevel } from "@/i18n/constants";
import { CANADIAN_LANGUAGES } from "@/i18n/constants";

export type AccountFieldsState = {
  full_name: string;
  phone: string;
  postal_code: string;
  address: string;
  birthday: string;
  email_language: "en" | "fr";
};

export type LoadedProEditState = {
  formPatch: {
    firstNameOrBusiness: string;
    legalBusinessName: string;
    businessAddress: string;
    shortBio: string;
    yearsExperience: number | null;
    serviceAreas: string;
    startingPrice: string;
    selectedServices: string[];
    languagesSpoken: { code: string; level: LanguageLevel }[];
    availability: AvailabilityState;
  };
  serviceDetails: Record<string, { displayName: string; about: string }>;
  primaryCategorySlug: string;
  serviceAtWorkspaceOnly: boolean;
  offersWorkspace: boolean;
  offersTravel: boolean;
  serviceAreaValue: ServiceAreaValue;
  unavailableDates: UnavailableDatesMap;
  availableDateOverrides: string[];
  availabilityNotYet: boolean;
  proServiceTags: string[];
  pagePrimaryColor: string;
  pageSecondaryColor: string;
  pageAccentColor: string;
  pageBackgroundColor: string;
  existingPersonalPhotoUrl: string | null;
  existingIdDocumentUrl: string | null;
  existingPrimaryPhotoUrl: string | null;
  existingGalleryUrls: string[];
  isVerified: boolean;
};

function levelFromParsed(level: string | null): LanguageLevel {
  if (level === "basic" || level === "conversational" || level === "fluent") return level;
  return "fluent";
}

export function useLoadExistingProProfile(userId: string | undefined, enabled: boolean) {
  const [accountFields, setAccountFields] = useState<AccountFieldsState>({
    full_name: "",
    phone: "",
    postal_code: "",
    address: "",
    birthday: "",
    email_language: "en",
  });
  const [loaded, setLoaded] = useState(!enabled);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [proEdit, setProEdit] = useState<LoadedProEditState | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: userProf } = await supabase
        .from("profiles")
        .select("full_name, phone, postal_code, address, birthday, email_language")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (userProf) {
        setAccountFields({
          full_name: userProf.full_name?.trim() ?? "",
          phone: formatCanadianPhone(userProf.phone ?? ""),
          postal_code: userProf.postal_code ? formatCanadianPostal(userProf.postal_code) : "",
          address: "",
          birthday: userProf.birthday ?? "",
          email_language: userProf.email_language === "fr" ? "fr" : "en",
        });
      }

      const { data: pro } = await supabase.from("pro_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (cancelled) return;

      setHasExistingProfile(!!pro?.id);
      if (!pro?.id) {
        setProEdit(null);
        setLoaded(true);
        return;
      }

      const { data: services } = await supabase
        .from("pro_services")
        .select("category_slug, service_slug, display_name, description")
        .eq("pro_profile_id", pro.id);
      const { data: photos } = await supabase
        .from("pro_photos")
        .select("url, is_primary, caption")
        .eq("pro_profile_id", pro.id);

      if (cancelled) return;

      const { mainBio, entries } = splitBioAndLanguages(pro.bio, "en");
      const languagesSpoken: { code: string; level: LanguageLevel }[] = [];
      for (const e of entries) {
        const found = CANADIAN_LANGUAGES.find(
          (l) => l.nameEn.toLowerCase() === e.languageLabel.toLowerCase() || l.nameFr.toLowerCase() === e.languageLabel.toLowerCase(),
        );
        if (found) languagesSpoken.push({ code: found.code, level: levelFromParsed(e.level) });
      }

      const selectedServices: string[] = [];
      const serviceDetails: Record<string, { displayName: string; about: string }> = {};
      for (const s of services ?? []) {
        const key = `${s.category_slug}/${s.service_slug}`;
        selectedServices.push(key);
        serviceDetails[key] = {
          displayName: s.display_name?.trim() ?? "",
          about: s.description?.trim() ?? "",
        };
      }

      const parsedAvail = parseAvailabilityFromStorage(pro.availability);
      const proRow = pro as {
        unavailable_dates?: UnavailableDatesMap;
        available_date_overrides?: string[];
      };
      const unavailableDates = proRow.unavailable_dates ?? {};
      const availableDateOverrides = Array.isArray(proRow.available_date_overrides) ? proRow.available_date_overrides : [];

      const primary = photos?.find((p) => p.is_primary);
      const gallery = (photos ?? []).filter((p) => !p.is_primary && p.caption === "before_after");

      setProEdit({
        formPatch: {
          firstNameOrBusiness: pro.business_name?.trim() ?? "",
          legalBusinessName: pro.legal_business_name?.trim() ?? "",
          businessAddress: pro.business_address?.trim() || userProf?.address?.trim() || "",
          shortBio: mainBio,
          yearsExperience: pro.years_experience ?? null,
          serviceAreas: pro.location?.trim() ?? "",
          startingPrice: pro.price_min != null ? String(pro.price_min) : "",
          selectedServices,
          languagesSpoken,
          availability: parsedAvail ?? defaultAvailability(),
        },
        serviceDetails,
        primaryCategorySlug: pro.primary_category_slug?.trim() ?? "",
        serviceAtWorkspaceOnly: pro.service_at_workspace_only === true,
        offersWorkspace: (() => {
          const o = pro as { offers_workspace?: boolean | null; offers_travel?: boolean | null };
          if (o.offers_workspace != null) return o.offers_workspace === true;
          return pro.service_at_workspace_only === true || pro.service_at_workspace_only == null;
        })(),
        offersTravel: (() => {
          const o = pro as { offers_workspace?: boolean | null; offers_travel?: boolean | null };
          if (o.offers_travel != null) return o.offers_travel === true;
          return pro.service_at_workspace_only !== true;
        })(),
        serviceAreaValue: {
          latitude: pro.latitude ?? null,
          longitude: pro.longitude ?? null,
          service_radius_km: pro.service_radius_km ?? 25,
          location: pro.location ?? null,
        },
        unavailableDates,
        availableDateOverrides,
        availabilityNotYet: !pro.availability?.trim(),
        proServiceTags: Array.isArray(pro.service_tags) ? pro.service_tags.filter((t): t is string => typeof t === "string") : [],
        pagePrimaryColor: (pro as { page_primary_color?: string }).page_primary_color ?? "#1e3a5f",
        pageSecondaryColor: (pro as { page_secondary_color?: string }).page_secondary_color ?? "#0d9488",
        pageAccentColor: (pro as { page_accent_color?: string }).page_accent_color ?? "#e0f2f1",
        pageBackgroundColor: (pro as { page_background_color?: string }).page_background_color ?? "#f8fafc",
        existingPersonalPhotoUrl: pro.personal_photo_url ?? null,
        existingIdDocumentUrl: pro.id_document_url ?? null,
        existingPrimaryPhotoUrl: primary?.url ?? null,
        existingGalleryUrls: gallery.map((g) => g.url),
        isVerified: pro.is_verified === true,
      });

      if (pro.email_language === "fr" || pro.email_language === "en") {
        setAccountFields((prev) => ({ ...prev, email_language: pro.email_language as "en" | "fr" }));
      }

      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return { accountFields, setAccountFields, loaded, hasExistingProfile, proEdit };
}
