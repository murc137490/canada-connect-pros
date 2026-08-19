import type { Service, ServiceCategory } from "./serviceTypes";

/** Bilingual labels — English is the canonical service name & routing key */
export const BILINGUAL_SERVICES: { en: string; fr: string }[] = [
  { en: "Kitchen Remodel", fr: "Rénovation de cuisine" },
  { en: "Bathroom Remodel", fr: "Rénovation de salle de bain" },
  { en: "Basement Finishing", fr: "Finition de sous-sol" },
  { en: "Home Addition", fr: "Agrandissement de maison" },

  { en: "Plumbing Services", fr: "Services de plomberie" },
  { en: "Drain Cleaning", fr: "Débouchage de drains" },
  { en: "Water Heater Services", fr: "Services de chauffe-eau" },

  { en: "Electrical Services", fr: "Services électriques" },
  { en: "Lighting Installation", fr: "Installation d'éclairage" },
  { en: "EV Charger Installation", fr: "Installation de borne de recharge" },

  { en: "HVAC Services", fr: "Services CVAC" },
  { en: "Furnace Repair", fr: "Réparation de fournaise" },
  { en: "AC Repair", fr: "Réparation de climatisation" },

  { en: "Roof Repair", fr: "Réparation de toiture" },
  { en: "Roof Replacement", fr: "Remplacement de toiture" },

  { en: "Window Services", fr: "Services de fenêtres" },
  { en: "Door Installation", fr: "Installation de portes" },

  { en: "Flooring Installation", fr: "Installation de planchers" },
  { en: "Tile Installation", fr: "Installation de tuiles" },

  { en: "Interior Painting", fr: "Peinture intérieure" },
  { en: "Exterior Painting", fr: "Peinture extérieure" },

  { en: "Appliance Repair", fr: "Réparation d'électroménagers" },
  { en: "Refrigerator Repair", fr: "Réparation de réfrigérateur" },

  { en: "Snow Removal", fr: "Déneigement" },
  { en: "Snow Plowing", fr: "Déneigement mécanique" },
  { en: "Lawn Care", fr: "Entretien de pelouse" },
  { en: "Landscaping Services", fr: "Aménagement paysager" },
  { en: "Tree Services", fr: "Services d'arbres" },
  { en: "Driveway Services", fr: "Services d'entrée (stationnement)" },
  { en: "Deck & Patio Construction", fr: "Construction de patio et terrasse" },

  { en: "House Cleaning", fr: "Ménage résidentiel" },
  { en: "Deep Cleaning", fr: "Nettoyage en profondeur" },
  { en: "Move-In/Out Cleaning", fr: "Nettoyage déménagement" },
  { en: "Carpet Cleaning", fr: "Nettoyage de tapis" },
  { en: "Window Cleaning", fr: "Nettoyage de fenêtres" },
  { en: "Commercial Cleaning", fr: "Nettoyage commercial" },
  { en: "Pressure Washing", fr: "Lavage à pression" },

  { en: "Accountant", fr: "Comptable" },
  { en: "Tax Preparation", fr: "Préparation d'impôts" },
  { en: "Bookkeeping", fr: "Tenue de livres" },
  { en: "Web Development", fr: "Développement web" },
  { en: "SEO Services", fr: "Services SEO" },
  { en: "Marketing Services", fr: "Services marketing" },
  { en: "IT Support", fr: "Soutien informatique" },

  { en: "Wedding Photographer", fr: "Photographe de mariage" },
  { en: "Event Photographer", fr: "Photographe d'événement" },
  { en: "Videographer", fr: "Vidéaste" },
  { en: "DJ Services", fr: "DJ" },
  { en: "Catering", fr: "Service de traiteur" },
  { en: "Event Planning", fr: "Organisation d'événements" },
  { en: "Entertainer", fr: "Artiste" },

  { en: "Math Tutor", fr: "Tuteur de mathématiques" },
  { en: "French Tutor", fr: "Tuteur de français" },
  { en: "English Tutor", fr: "Tuteur d'anglais" },
  { en: "Music Lessons", fr: "Cours de musique" },
  { en: "Driving Lessons", fr: "Cours de conduite" },

  { en: "Dog Walking", fr: "Promenade de chien" },
  { en: "Pet Sitting", fr: "Garde d'animaux" },
  { en: "Dog Grooming", fr: "Toilettage de chien" },
  { en: "Dog Training", fr: "Dressage de chien" },

  { en: "Personal Trainer", fr: "Entraîneur personnel" },
  { en: "Massage Therapy", fr: "Massothérapie" },
  { en: "Therapist / Counselling", fr: "Thérapie / counseling" },
  { en: "Nutritionist", fr: "Nutritionniste" },

  { en: "Local Moving", fr: "Déménagement local" },
  { en: "Long Distance Moving", fr: "Déménagement longue distance" },
  { en: "Furniture Assembly", fr: "Assemblage de meubles" },
  { en: "TV Mounting", fr: "Installation de télévision" },
  { en: "Appliance Installation", fr: "Installation d'électroménagers" },

  { en: "Home Inspection", fr: "Inspection de maison" },
  { en: "Pest Control", fr: "Extermination" },
  { en: "Locksmith", fr: "Serrurier" },
  { en: "Security System Installation", fr: "Installation de système de sécurité" },
  { en: "Property Management", fr: "Gestion immobilière" },
];

/** Every catalog service name in English (same order as `BILINGUAL_SERVICES`). */
export const ALL_SERVICE_NAMES_EN: readonly string[] = BILINGUAL_SERVICES.map((s) => s.en);

export function toServiceSlug(en: string): string {
  return en
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Which subcategory each service belongs to (for UI grouping) */
const SERVICE_META: { en: string; categorySlug: string; categoryName: string; subcategory: string }[] = [
  // Home improvement
  ...["Kitchen Remodel", "Bathroom Remodel", "Basement Finishing", "Home Addition"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Renovation & additions",
  })),
  ...["Plumbing Services", "Drain Cleaning", "Water Heater Services"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Plumbing",
  })),
  ...["Electrical Services", "Lighting Installation", "EV Charger Installation"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Electrical",
  })),
  ...["HVAC Services", "Furnace Repair", "AC Repair"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Heating & cooling",
  })),
  ...["Roof Repair", "Roof Replacement"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Roofing",
  })),
  ...["Window Services", "Door Installation"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Windows & doors",
  })),
  ...["Flooring Installation", "Tile Installation"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Flooring",
  })),
  ...["Interior Painting", "Exterior Painting"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Painting",
  })),
  ...["Appliance Repair", "Refrigerator Repair"].map((en) => ({
    en,
    categorySlug: "home-improvement",
    categoryName: "Home Improvement",
    subcategory: "Appliances",
  })),

  ...["Snow Removal", "Snow Plowing", "Lawn Care", "Landscaping Services", "Tree Services", "Driveway Services", "Deck & Patio Construction"].map((en) => ({
    en,
    categorySlug: "outdoor-seasonal",
    categoryName: "Outdoor & Seasonal",
    subcategory: "Outdoor & seasonal",
  })),

  ...["House Cleaning", "Deep Cleaning", "Move-In/Out Cleaning", "Carpet Cleaning", "Window Cleaning", "Commercial Cleaning", "Pressure Washing"].map((en) => ({
    en,
    categorySlug: "cleaning",
    categoryName: "Cleaning",
    subcategory: "Cleaning services",
  })),

  ...["Accountant", "Tax Preparation", "Bookkeeping", "Web Development", "SEO Services", "Marketing Services", "IT Support"].map((en) => ({
    en,
    categorySlug: "business",
    categoryName: "Business Services",
    subcategory: "Business services",
  })),

  ...["Wedding Photographer", "Event Photographer", "Videographer", "DJ Services", "Catering", "Event Planning", "Entertainer"].map((en) => ({
    en,
    categorySlug: "events",
    categoryName: "Events & Entertainment",
    subcategory: "Events",
  })),

  ...["Math Tutor", "French Tutor", "English Tutor", "Music Lessons", "Driving Lessons"].map((en) => ({
    en,
    categorySlug: "lessons",
    categoryName: "Lessons & Tutoring",
    subcategory: "Lessons",
  })),

  ...["Dog Walking", "Pet Sitting", "Dog Grooming", "Dog Training"].map((en) => ({
    en,
    categorySlug: "pets",
    categoryName: "Pets",
    subcategory: "Pet care",
  })),

  ...["Personal Trainer", "Massage Therapy", "Therapist / Counselling", "Nutritionist"].map((en) => ({
    en,
    categorySlug: "wellness",
    categoryName: "Wellness",
    subcategory: "Wellness",
  })),

  ...["Local Moving", "Long Distance Moving", "Furniture Assembly", "TV Mounting", "Appliance Installation"].map((en) => ({
    en,
    categorySlug: "moving",
    categoryName: "Moving & Storage",
    subcategory: "Moving & install",
  })),

  ...["Home Inspection", "Pest Control", "Locksmith", "Security System Installation", "Property Management"].map((en) => ({
    en,
    categorySlug: "security-inspection",
    categoryName: "Home Security & Inspection",
    subcategory: "Inspection & security",
  })),
];

function buildServiceCategories(): ServiceCategory[] {
  const catOrder = [
    "home-improvement",
    "outdoor-seasonal",
    "cleaning",
    "business",
    "events",
    "lessons",
    "pets",
    "wellness",
    "moving",
    "security-inspection",
  ];
  const metaByEn = new Map(SERVICE_META.map((m) => [m.en, m]));
  const catMeta: Record<string, { name: string; icon: string; color: string; description: string }> = {
    "home-improvement": {
      name: "Home Improvement",
      icon: "Home",
      color: "category-home",
      description: "Renovations, repairs, and upgrades for your home.",
    },
    "outdoor-seasonal": {
      name: "Outdoor & Seasonal",
      icon: "TreePine",
      color: "category-outdoor",
      description: "Snow, lawn, landscaping, and exterior projects.",
    },
    cleaning: {
      name: "Cleaning",
      icon: "Sparkles",
      color: "category-cleaning",
      description: "Residential and commercial cleaning services.",
    },
    business: {
      name: "Business Services",
      icon: "Briefcase",
      color: "category-business",
      description: "Accounting, tech, marketing, and more for businesses.",
    },
    events: {
      name: "Events & Entertainment",
      icon: "PartyPopper",
      color: "category-events",
      description: "Photos, video, catering, and event planning.",
    },
    lessons: {
      name: "Lessons & Tutoring",
      icon: "GraduationCap",
      color: "category-lessons",
      description: "Tutoring, music, driving, and skills training.",
    },
    pets: {
      name: "Pets",
      icon: "PawPrint",
      color: "category-pets",
      description: "Walking, grooming, training, and pet care.",
    },
    wellness: {
      name: "Wellness",
      icon: "Heart",
      color: "category-wellness",
      description: "Fitness, massage, therapy, and nutrition.",
    },
    moving: {
      name: "Moving & Storage",
      icon: "Truck",
      color: "category-moving",
      description: "Moving, assembly, and installation help.",
    },
    "security-inspection": {
      name: "Home Security & Inspection",
      icon: "Shield",
      color: "category-tech",
      description: "Inspections, pests, locks, and property services.",
    },
  };

  const grouped = new Map<string, Map<string, Service[]>>();

  for (const { en, fr } of BILINGUAL_SERVICES) {
    const m = metaByEn.get(en);
    if (!m) continue;
    const slug = toServiceSlug(en);
    if (!grouped.has(m.categorySlug)) grouped.set(m.categorySlug, new Map());
    const subMap = grouped.get(m.categorySlug)!;
    if (!subMap.has(m.subcategory)) subMap.set(m.subcategory, []);
    subMap.get(m.subcategory)!.push({ name: en, slug });
  }

  return catOrder
    .filter((cs) => grouped.has(cs))
    .map((categorySlug) => {
      const cm = catMeta[categorySlug];
      const subMap = grouped.get(categorySlug)!;
      const subcategories = [...subMap.entries()].map(([name, services]) => ({ name, services }));
      return {
        name: cm.name,
        slug: categorySlug,
        icon: cm.icon,
        color: cm.color,
        description: cm.description,
        subcategories,
      };
    });
}

export const serviceCategories: ServiceCategory[] = buildServiceCategories();

export function getAllServices(): (Service & { category: string; categorySlug: string; subcategory: string; fr?: string })[] {
  const frByEn = new Map(BILINGUAL_SERVICES.map((x) => [x.en, x.fr]));
  const all: (Service & { category: string; categorySlug: string; subcategory: string; fr?: string })[] = [];
  for (const cat of serviceCategories) {
    for (const sub of cat.subcategories) {
      for (const svc of sub.services) {
        all.push({
          ...svc,
          category: cat.name,
          categorySlug: cat.slug,
          subcategory: sub.name,
          fr: frByEn.get(svc.name),
        });
      }
    }
  }
  return all;
}

export function getTotalServiceCount(): number {
  return getAllServices().length;
}

export interface ServiceRecordForAI {
  name: string;
  slug: string;
  categoryName: string;
  categorySlug: string;
  subcategory: string;
  /** Bilingual string for embedding (EN + FR) */
  embedText: string;
}

export interface CategorySummaryForAI {
  name: string;
  slug: string;
  serviceCount: number;
  subcategories: { name: string; serviceCount: number }[];
}

/** Extra English/French terms for embeddings only (improves HF similarity vs short titles). */
const EMBED_HINTS_BY_SLUG: Partial<Record<string, string>> = {
  "it-support":
    "computer laptop phone tablet mobile repair wifi network router software technical help desk troubleshooting IT",
  "web-development":
    "website app coding developer programming software",
  "seo-services": "search engine ranking website visibility",
  "marketing-services": "advertising brand promotion digital",
  "appliance-repair":
    "fridge refrigerator washer dryer oven dishwasher kitchen appliances",
  "refrigerator-repair":
    "fridge refrigerator freezer not cooling cold enough appliance ice maker leak water under",
  "roof-repair":
    "roof leak leaking shingles attic gutter winter snow ice damage storm water ceiling stain",
  "roof-replacement":
    "new roof shingles tear off full roof replacement aging roof",
  "deck-and-patio-construction":
    "deck patio backyard outdoor wood composite build builder railing stairs terrace",
  entertainer:
    "performer live show musician singer band magician clown host MC animation spectacle fête party wedding corporate artiste divertissement musique humoriste",
};

/** Bilingual + optional slug hints for HF embeddings (hero + search-suggestions). */
export function buildAiEmbedTextForServiceSlug(serviceSlug: string, primaryLabel: string): string {
  const s = getAllServices().find((x) => x.slug === serviceSlug);
  const catalogEn = s?.name ?? serviceSlug.replace(/-/g, " ");
  const fr = s?.fr ?? catalogEn;
  const hint = EMBED_HINTS_BY_SLUG[serviceSlug];
  if (hint) return `${primaryLabel} | ${catalogEn} | ${fr} | ${hint}`;
  return `${primaryLabel} | ${catalogEn} | ${fr}`;
}

export function getFlatServiceRecords(): ServiceRecordForAI[] {
  return getAllServices().map((s) => ({
    name: s.name,
    slug: s.slug,
    categoryName: s.category,
    categorySlug: s.categorySlug,
    subcategory: s.subcategory,
    embedText: buildAiEmbedTextForServiceSlug(s.slug, s.name),
  }));
}

export function getCategorySummariesForAI(): CategorySummaryForAI[] {
  return serviceCategories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    serviceCount: cat.subcategories.reduce((n, sub) => n + sub.services.length, 0),
    subcategories: cat.subcategories.map((sub) => ({
      name: sub.name,
      serviceCount: sub.services.length,
    })),
  }));
}
