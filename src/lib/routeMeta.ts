import { getAllServices, serviceCategories } from "@/data/services";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import type { Locale } from "@/i18n/translations";

/** Preferred public origin for search engines and share cards. */
export const CANONICAL_ORIGIN = "https://www.altshift.ca";

export const OG_IMAGE_PATH = "/og-image.png";

export type PageCopy = {
  title: string;
  description: string;
};

export type RouteMeta = PageCopy & {
  /** Path used in rel=canonical and og:url. Query strings are omitted. */
  canonicalPath: string;
  /**
   * Single path segment that is not a known page. It may still be a pro vanity URL,
   * so the shell stays neutral until the profile lookup finishes.
   */
  pendingProLookup: boolean;
  notFound: boolean;
};

const BRAND = "AltShift";

function withBrand(title: string): string {
  return title.includes(BRAND) ? title : `${title} | ${BRAND}`;
}

function copy(title: string, description: string): PageCopy {
  return { title: withBrand(title), description };
}

const NOT_FOUND: Record<Locale, PageCopy> = {
  en: copy("Page not found", "This page does not exist on AltShift."),
  fr: copy("Page introuvable", "Cette page n'existe pas sur AltShift."),
};

/** Static routes. Alphanumeric paths must be listed so they are not treated as pro slugs. */
const EXACT: Record<string, Record<Locale, PageCopy>> = {
  "/": {
    en: copy(
      "AltShift | Local service professionals",
      "Describe your need and receive quotes from trusted local service professionals across Quebec and Canada.",
    ),
    fr: copy(
      "AltShift | Professionnels de services locaux",
      "Décrivez votre besoin et recevez des soumissions de professionnels de confiance au Québec et au Canada.",
    ),
  },
  "/services": {
    en: copy(
      "Local services",
      "Browse home, cleaning, outdoor, and other local services. Compare professionals on AltShift.",
    ),
    fr: copy(
      "Services locaux",
      "Parcourez les services locaux : maison, nettoyage, extérieur et plus. Comparez les professionnels sur AltShift.",
    ),
  },
  "/about": {
    en: copy(
      "About us",
      "AltShift helps neighbours in Granby and across Quebec offer their skills and book trustworthy local help.",
    ),
    fr: copy(
      "Un peu sur nous",
      "AltShift aide les voisins de Granby et du Québec à offrir leurs compétences et à réserver de l'aide locale de confiance.",
    ),
  },
  "/join-pros": {
    en: copy(
      "For professionals",
      "Offer your skills on AltShift. See how local professionals join, get listed, and receive booking requests.",
    ),
    fr: copy(
      "Pour les professionnels",
      "Offrez vos compétences sur AltShift. Voyez comment les professionnels locaux s'inscrivent et reçoivent des demandes.",
    ),
  },
  "/join-pros/plans": {
    en: copy(
      "Professional plans",
      "Compare AltShift plans for professionals and choose the tools that fit your business.",
    ),
    fr: copy(
      "Forfaits professionnels",
      "Comparez les forfaits AltShift pour les professionnels et choisissez les outils adaptés à votre activité.",
    ),
  },
  "/support": {
    en: copy("Support", "Get help with AltShift bookings, accounts, payments, and adding the app to your home screen."),
    fr: copy(
      "Aide",
      "Aide pour les réservations, les comptes, les paiements et l'ajout d'AltShift à votre écran d'accueil.",
    ),
  },
  "/make-request": {
    en: copy("Post a job", "Post a job on AltShift and receive quotes from local service professionals."),
    fr: copy("Publier une demande", "Publiez une demande sur AltShift et recevez des soumissions de professionnels locaux."),
  },
  "/terms": {
    en: copy("Terms of Service", "Terms of Service for AltShift, operated by Les Services AltShift Inc."),
    fr: copy("Conditions d'utilisation", "Conditions d'utilisation d'AltShift, exploité par Les Services AltShift Inc."),
  },
  "/privacy": {
    en: copy("Privacy Policy", "How Les Services AltShift Inc. collects and uses personal information on AltShift."),
    fr: copy(
      "Politique de confidentialité",
      "Comment Les Services AltShift Inc. recueille et utilise les renseignements personnels sur AltShift.",
    ),
  },
  "/cookies": {
    en: copy("Cookie Policy", "How AltShift uses cookies and similar technologies on this site."),
    fr: copy("Politique relative aux témoins", "Comment AltShift utilise les témoins et technologies similaires sur ce site."),
  },
  "/get-app/android": {
    en: copy("Add AltShift on Android", "Install AltShift on your Android home screen from Chrome."),
    fr: copy("Ajouter AltShift sur Android", "Installez AltShift sur l'écran d'accueil Android depuis Chrome."),
  },
  "/get-app/ios": {
    en: copy("Add AltShift on iPhone", "Add AltShift to your iPhone home screen from Safari."),
    fr: copy("Ajouter AltShift sur iPhone", "Ajoutez AltShift à l'écran d'accueil de votre iPhone depuis Safari."),
  },
  "/help/dashboard-guide": {
    en: copy("Dashboard guide", "A short guide to the AltShift dashboard."),
    fr: copy("Guide du tableau de bord", "Un court guide du tableau de bord AltShift."),
  },
  "/dashboard": {
    en: copy("Dashboard", "Your AltShift dashboard."),
    fr: copy("Tableau de bord", "Votre tableau de bord AltShift."),
  },
  "/auth": {
    en: copy("Sign in", "Sign in or create an AltShift account."),
    fr: copy("Connexion", "Connectez-vous ou créez un compte AltShift."),
  },
  "/auth/callback": {
    en: copy("Signing in", "Finishing sign-in to AltShift."),
    fr: copy("Connexion", "Fin de la connexion à AltShift."),
  },
  "/reset-password": {
    en: copy("Reset password", "Choose a new password for your AltShift account."),
    fr: copy("Réinitialiser le mot de passe", "Choisissez un nouveau mot de passe pour votre compte AltShift."),
  },
  "/confirm-deletion": {
    en: copy("Confirm deletion", "Confirm deletion of your AltShift account."),
    fr: copy("Confirmer la suppression", "Confirmez la suppression de votre compte AltShift."),
  },
  "/create-pro-account": {
    en: copy("Create a pro account", "Create your AltShift professional account."),
    fr: copy("Créer un compte pro", "Créez votre compte professionnel AltShift."),
  },
  "/pro-onboarding/start": {
    en: copy("Pro onboarding", "Start your AltShift professional profile."),
    fr: copy("Inscription pro", "Commencez votre profil professionnel AltShift."),
  },
  "/pro-onboarding/tier": {
    en: copy("Choose a plan", "Choose an AltShift plan for your professional profile."),
    fr: copy("Choisir un forfait", "Choisissez un forfait AltShift pour votre profil professionnel."),
  },
  "/pro-plans": {
    en: copy("Your plan", "Manage your AltShift professional plan."),
    fr: copy("Votre forfait", "Gérez votre forfait professionnel AltShift."),
  },
  "/pro-plans/trial": {
    en: copy("Growth trial", "Start a Growth trial on AltShift."),
    fr: copy("Essai Croissance", "Démarrez un essai Croissance sur AltShift."),
  },
  "/pro-plans/freetrial": {
    en: copy("Growth trial", "Start a Growth trial on AltShift."),
    fr: copy("Essai Croissance", "Démarrez un essai Croissance sur AltShift."),
  },
  "/pro-plans/cancel": {
    en: copy("Cancel your plan", "Cancel your AltShift professional plan."),
    fr: copy("Annuler votre forfait", "Annulez votre forfait professionnel AltShift."),
  },
  "/phone-preview": {
    en: copy("Phone preview", "AltShift phone preview."),
    fr: copy("Aperçu téléphone", "Aperçu téléphone AltShift."),
  },
  "/admin/accept-pros": {
    en: copy("Accept pros", "AltShift admin: review professional applications."),
    fr: copy("Accepter les pros", "Admin AltShift : examiner les demandes de professionnels."),
  },
  "/admin/issue-reports": {
    en: copy("Issue reports", "AltShift admin: issue reports."),
    fr: copy("Signalements", "Admin AltShift : signalements."),
  },
  "/admin/job-requests": {
    en: copy("Job requests", "AltShift admin: job requests."),
    fr: copy("Demandes", "Admin AltShift : demandes."),
  },
  "/admin/trial-tokens": {
    en: copy("Trial links", "AltShift admin: trial links."),
    fr: copy("Liens d'essai", "Admin AltShift : liens d'essai."),
  },
};

/** Duplicate URLs that should advertise one canonical path. */
const CANONICAL_ALIASES: Record<string, string> = {
  "/a-propos": "/about",
  "/privacy-policy": "/privacy",
  "/politique-de-confidentialite": "/privacy",
  "/cookie-policy": "/cookies",
  "/get-app": "/get-app/android",
  "/pro-plans/checkout": "/pro-plans",
  "/admin": "/dashboard",
};

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function notFoundMeta(locale: Locale, pathname: string): RouteMeta {
  const path = normalizePathname(pathname);
  return {
    ...NOT_FOUND[locale],
    canonicalPath: path,
    pendingProLookup: false,
    notFound: true,
  };
}

function finish(locale: Locale, canonicalPath: string, page: PageCopy, flags?: Partial<Pick<RouteMeta, "pendingProLookup" | "notFound">>): RouteMeta {
  return {
    ...page,
    canonicalPath,
    pendingProLookup: flags?.pendingProLookup ?? false,
    notFound: flags?.notFound ?? false,
  };
}

export function resolveRouteMeta(pathname: string, locale: Locale): RouteMeta {
  const path = normalizePathname(pathname);
  const canonicalPath = CANONICAL_ALIASES[path] ?? path;
  const exact = EXACT[canonicalPath] ?? EXACT[path];
  if (exact) return finish(locale, canonicalPath, exact[locale]);

  const categoryMatch = path.match(/^\/services\/([^/]+)$/);
  if (categoryMatch) {
    const slug = categoryMatch[1];
    const category = serviceCategories.find((c) => c.slug === slug);
    if (!category) return notFoundMeta(locale, path);
    const name = getCategoryName(category, locale);
    return finish(
      locale,
      path,
      copy(
        name,
        locale === "fr"
          ? `Trouvez des professionnels en ${name} sur AltShift, au Québec et au Canada.`
          : `Find ${name} professionals on AltShift across Quebec and Canada.`,
      ),
    );
  }

  const serviceMatch = path.match(/^\/services\/([^/]+)\/([^/]+)(?:\/pros)?$/);
  if (serviceMatch) {
    const serviceSlug = serviceMatch[2];
    const service = getAllServices().find((s) => s.slug === serviceSlug && s.categorySlug === serviceMatch[1]);
    if (!service) return notFoundMeta(locale, path);
    const name = getServiceName(service.slug, locale, service.name);
    const canonical = `/services/${service.categorySlug}/${service.slug}/pros`;
    return finish(
      locale,
      canonical,
      copy(
        name,
        locale === "fr"
          ? `Professionnels pour ${name} sur AltShift. Comparez les profils et demandez une soumission.`
          : `${name} professionals on AltShift. Compare profiles and request a quote.`,
      ),
    );
  }

  if (path.startsWith("/pros/")) {
    return finish(
      locale,
      path,
      copy(
        locale === "fr" ? "Profil professionnel" : "Professional profile",
        locale === "fr"
          ? "Profil d'un professionnel sur AltShift."
          : "A professional profile on AltShift.",
      ),
    );
  }

  if (path.startsWith("/pay/apple-handoff/")) {
    return finish(locale, path, copy("Apple Pay", locale === "fr" ? "Paiement Apple Pay sur AltShift." : "Apple Pay checkout on AltShift."));
  }

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && /^[A-Za-z0-9]+$/.test(segments[0])) {
    return finish(
      locale,
      path,
      { title: BRAND, description: EXACT["/"][locale].description },
      { pendingProLookup: true },
    );
  }

  return notFoundMeta(locale, path);
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Write title, description, Open Graph, Twitter, and canonical tags for the active route. */
export function applyDocumentMeta(meta: RouteMeta, locale: Locale) {
  if (typeof document === "undefined") return;
  const image = `${CANONICAL_ORIGIN}${OG_IMAGE_PATH}`;
  const canonical = `${CANONICAL_ORIGIN}${meta.canonicalPath === "/" ? "/" : meta.canonicalPath}`;
  const ogLocale = locale === "fr" ? "fr_CA" : "en_CA";
  const ogLocaleAlt = locale === "fr" ? "en_CA" : "fr_CA";

  document.title = meta.title;
  upsertMeta("name", "description", meta.description);
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", meta.description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:site_name", BRAND);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  upsertMeta("property", "og:image:alt", BRAND);
  upsertMeta("property", "og:locale", ogLocale);
  upsertMeta("property", "og:locale:alternate", ogLocaleAlt);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", meta.title);
  upsertMeta("name", "twitter:description", meta.description);
  upsertMeta("name", "twitter:image", image);
  upsertLink("canonical", canonical);
}
