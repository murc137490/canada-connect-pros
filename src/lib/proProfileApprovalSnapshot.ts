/** Serializable pro application state for admin before/after review. */
export type ProProfileApprovalSnapshot = {
  v: 1;
  business_name: string;
  legal_business_name: string | null;
  business_address: string | null;
  bio: string | null;
  years_experience: number | null;
  location: string | null;
  service_at_workspace_only: boolean;
  service_radius_km: number | null;
  price_min: number | null;
  primary_category_slug: string | null;
  availability: string | null;
  account: {
    full_name: string | null;
    phone: string | null;
    postal_code: string | null;
    address: string | null;
    birthday: string | null;
    email_language: string | null;
  };
  services: { key: string; display_name: string | null; description: string | null }[];
  languages_spoken: { code: string; level: string }[];
};

export type ProProfileSnapshotDiff = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const FIELD_LABELS: Record<string, string> = {
  business_name: "Business name",
  legal_business_name: "Legal business name",
  business_address: "Business address (invoices)",
  bio: "Bio",
  years_experience: "Years of experience",
  location: "Service area",
  service_at_workspace_only: "Service mode",
  service_radius_km: "Service radius (km)",
  price_min: "Starting price",
  primary_category_slug: "Main category",
  availability: "Weekly availability",
  "account.full_name": "Account name",
  "account.phone": "Phone",
  "account.postal_code": "Postal code",
  "account.address": "Home / service address",
  "account.birthday": "Birthday",
  "account.email_language": "Preferred language",
  services: "Services offered",
};

function displayVal(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function serviceListText(services: ProProfileApprovalSnapshot["services"]): string {
  if (!services.length) return "—";
  return services
    .map((s) => {
      const parts = [s.key.replace("/", " · ")];
      if (s.display_name?.trim()) parts.push(`"${s.display_name.trim()}"`);
      if (s.description?.trim()) parts.push(`— ${s.description.trim().slice(0, 80)}`);
      return parts.join(" ");
    })
    .join("\n");
}

function languagesText(langs: ProProfileApprovalSnapshot["languages_spoken"]): string {
  if (!langs.length) return "—";
  return langs.map((l) => `${l.code} (${l.level})`).join(", ");
}

export function buildProProfileApprovalSnapshot(input: {
  business_name: string;
  legal_business_name?: string | null;
  business_address?: string | null;
  bio?: string | null;
  years_experience?: number | null;
  location?: string | null;
  service_at_workspace_only?: boolean | null;
  service_radius_km?: number | null;
  price_min?: number | null;
  primary_category_slug?: string | null;
  availability?: string | null;
  account?: Partial<ProProfileApprovalSnapshot["account"]>;
  services?: { category_slug: string; service_slug: string; display_name?: string | null; description?: string | null }[];
  languages_spoken?: { code: string; level: string }[];
}): ProProfileApprovalSnapshot {
  const services = (input.services ?? []).map((s) => ({
    key: `${s.category_slug}/${s.service_slug}`,
    display_name: s.display_name ?? null,
    description: s.description ?? null,
  }));
  services.sort((a, b) => a.key.localeCompare(b.key));

  return {
    v: 1,
    business_name: input.business_name.trim(),
    legal_business_name: input.legal_business_name?.trim() || null,
    business_address: input.business_address?.trim() || null,
    bio: input.bio?.trim() || null,
    years_experience: input.years_experience ?? null,
    location: input.location?.trim() || null,
    service_at_workspace_only: input.service_at_workspace_only === true,
    service_radius_km: input.service_radius_km ?? null,
    price_min: input.price_min ?? null,
    primary_category_slug: input.primary_category_slug?.trim() || null,
    availability: input.availability?.trim() || null,
    account: {
      full_name: input.account?.full_name?.trim() || null,
      phone: input.account?.phone?.trim() || null,
      postal_code: input.account?.postal_code?.trim() || null,
      address: input.account?.address?.trim() || null,
      birthday: input.account?.birthday?.trim() || null,
      email_language: input.account?.email_language?.trim() || null,
    },
    services,
    languages_spoken: input.languages_spoken ?? [],
  };
}

export function snapshotFromProProfileRow(
  profile: Record<string, unknown>,
  services: { category_slug: string; service_slug: string; display_name?: string | null; description?: string | null }[],
  account: Partial<ProProfileApprovalSnapshot["account"]> | null,
  languages_spoken: { code: string; level: string }[],
): ProProfileApprovalSnapshot {
  return buildProProfileApprovalSnapshot({
    business_name: String(profile.business_name ?? ""),
    legal_business_name: (profile.legal_business_name as string) ?? null,
    business_address: (profile.business_address as string) ?? null,
    bio: (profile.bio as string) ?? null,
    years_experience: (profile.years_experience as number) ?? null,
    location: (profile.location as string) ?? null,
    service_at_workspace_only: profile.service_at_workspace_only as boolean | null,
    service_radius_km: (profile.service_radius_km as number) ?? null,
    price_min: (profile.price_min as number) ?? null,
    primary_category_slug: (profile.primary_category_slug as string) ?? null,
    availability: (profile.availability as string) ?? null,
    account: account ?? undefined,
    services,
    languages_spoken,
  });
}

export function parseApprovalBaselineJson(raw: unknown): ProProfileApprovalSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as ProProfileApprovalSnapshot;
  if (o.v !== 1 || typeof o.business_name !== "string") return null;
  return o;
}

export function diffProProfileSnapshots(
  baseline: ProProfileApprovalSnapshot,
  current: ProProfileApprovalSnapshot,
  locale: "en" | "fr" = "en",
): ProProfileSnapshotDiff[] {
  const diffs: ProProfileSnapshotDiff[] = [];
  const label = (key: string) => {
    if (locale === "fr") {
      const fr: Record<string, string> = {
        business_name: "Nom d'entreprise",
        legal_business_name: "Raison sociale",
        business_address: "Adresse d'entreprise (factures)",
        bio: "Bio",
        years_experience: "Années d'expérience",
        location: "Zone de service",
        service_at_workspace_only: "Mode de service",
        service_radius_km: "Rayon (km)",
        price_min: "Prix de départ",
        primary_category_slug: "Catégorie principale",
        availability: "Disponibilités",
        "account.full_name": "Nom du compte",
        "account.phone": "Téléphone",
        "account.postal_code": "Code postal",
        "account.address": "Adresse domicile / prestation",
        "account.birthday": "Date de naissance",
        "account.email_language": "Langue préférée",
        services: "Services offerts",
      };
      return fr[key] ?? FIELD_LABELS[key] ?? key;
    }
    return FIELD_LABELS[key] ?? key;
  };

  const scalarKeys: (keyof Omit<ProProfileApprovalSnapshot, "v" | "account" | "services" | "languages_spoken">)[] = [
    "business_name",
    "legal_business_name",
    "business_address",
    "bio",
    "years_experience",
    "location",
    "service_radius_km",
    "price_min",
    "primary_category_slug",
    "availability",
  ];

  for (const key of scalarKeys) {
    const b = baseline[key];
    const c = current[key];
    if (displayVal(b) !== displayVal(c)) {
      diffs.push({ field: key, label: label(key), before: displayVal(b), after: displayVal(c) });
    }
  }

  if (baseline.service_at_workspace_only !== current.service_at_workspace_only) {
    const mode = (w: boolean) =>
      w
        ? locale === "fr"
          ? "Sur place uniquement"
          : "Workspace only"
        : locale === "fr"
          ? "Se déplace chez le client"
          : "Travels to client";
    diffs.push({
      field: "service_at_workspace_only",
      label: label("service_at_workspace_only"),
      before: mode(baseline.service_at_workspace_only),
      after: mode(current.service_at_workspace_only),
    });
  }

  for (const accKey of Object.keys(baseline.account) as (keyof ProProfileApprovalSnapshot["account"])[]) {
    const b = baseline.account[accKey];
    const c = current.account[accKey];
    if (displayVal(b) !== displayVal(c)) {
      const fk = `account.${accKey}`;
      diffs.push({ field: fk, label: label(fk), before: displayVal(b), after: displayVal(c) });
    }
  }

  const bSvc = serviceListText(baseline.services);
  const cSvc = serviceListText(current.services);
  if (bSvc !== cSvc) {
    diffs.push({ field: "services", label: label("services"), before: bSvc, after: cSvc });
  }

  const bLang = languagesText(baseline.languages_spoken);
  const cLang = languagesText(current.languages_spoken);
  if (bLang !== cLang) {
    diffs.push({
      field: "languages_spoken",
      label: locale === "fr" ? "Langues parlées" : "Languages spoken",
      before: bLang,
      after: cLang,
    });
  }

  return diffs;
}
