/** High-resolution Unsplash photos + local Lottie files for services browse. */

export type CategoryVisual = {
  /** Unsplash photo id, e.g. photo-xxxxx */
  photoId: string;
  image: string;
  imageSrcSet: string;
  imageAltEn: string;
  imageAltFr: string;
  accent: string;
  lottie?: string;
  blurbEn: string;
  blurbFr: string;
};

/** Request large JPEG crops suitable for retina / wide category heroes. */
export function unsplashUrl(photoId: string, w = 2400) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=90&fm=jpg`;
}

export function unsplashSrcSet(photoId: string) {
  return [1200, 1800, 2400].map((w) => `${unsplashUrl(photoId, w)} ${w}w`).join(", ");
}

function visual(
  photoId: string,
  fields: Omit<CategoryVisual, "photoId" | "image" | "imageSrcSet">
): CategoryVisual {
  return {
    photoId,
    image: unsplashUrl(photoId, 2400),
    imageSrcSet: unsplashSrcSet(photoId),
    ...fields,
  };
}

export const categoryVisuals: Record<string, CategoryVisual> = {
  "home-improvement": visual("photo-1600585154340-be6161a56a0c", {
    imageAltEn: "Modern home renovation interior",
    imageAltFr: "Intérieur de maison rénovée",
    accent: "hsl(222 76% 32%)",
    lottie: "/lottie/home.json",
    blurbEn: "Plumbing, electrical, renovations, and repairs.",
    blurbFr: "Plomberie, électricité, rénovations et réparations.",
  }),
  "outdoor-seasonal": visual("photo-1558904541-efa843a96f01", {
    imageAltEn: "Garden and outdoor care",
    imageAltFr: "Jardin et entretien extérieur",
    accent: "hsl(100 40% 36%)",
    blurbEn: "Lawn, snow, landscaping, and seasonal help.",
    blurbFr: "Pelouse, neige, aménagement et aide saisonnière.",
  }),
  cleaning: visual("photo-1581578731548-c64695cc6952", {
    imageAltEn: "Professional house cleaning",
    imageAltFr: "Ménage professionnel",
    accent: "hsl(170 55% 32%)",
    lottie: "/lottie/cleaning.json",
    blurbEn: "Home, deep clean, move-in/out, and commercial.",
    blurbFr: "Résidentiel, en profondeur, déménagement et commercial.",
  }),
  business: visual("photo-1497366216548-37526070297c", {
    imageAltEn: "Business workspace",
    imageAltFr: "Espace de travail",
    accent: "hsl(217 75% 42%)",
    lottie: "/lottie/business.json",
    blurbEn: "Accounting, IT, marketing, and web support.",
    blurbFr: "Comptabilité, TI, marketing et soutien web.",
  }),
  events: visual("photo-1519741497674-611481863552", {
    imageAltEn: "Event celebration",
    imageAltFr: "Célébration d'événement",
    accent: "hsl(340 65% 42%)",
    blurbEn: "Photos, video, catering, DJ, and planning.",
    blurbFr: "Photos, vidéo, traiteur, DJ et organisation.",
  }),
  lessons: visual("photo-1503676260728-1c00da094a0b", {
    imageAltEn: "Tutoring and lessons",
    imageAltFr: "Tutorat et cours",
    accent: "hsl(160 50% 32%)",
    blurbEn: "Tutoring, music, driving, and skills training.",
    blurbFr: "Tutorat, musique, conduite et formation.",
  }),
  pets: visual("photo-1548199973-03cce0bbc87b", {
    imageAltEn: "Happy dogs outdoors",
    imageAltFr: "Chiens heureux à l'extérieur",
    accent: "hsl(25 70% 45%)",
    blurbEn: "Walking, grooming, sitting, and training.",
    blurbFr: "Promenade, toilettage, garde et dressage.",
  }),
  wellness: visual("photo-1544367567-0f2fcb009e0b", {
    imageAltEn: "Wellness and fitness",
    imageAltFr: "Bien-être et fitness",
    accent: "hsl(280 45% 45%)",
    blurbEn: "Training, massage, therapy, and nutrition.",
    blurbFr: "Entraînement, massage, thérapie et nutrition.",
  }),
  moving: visual("photo-1600518464441-9154a4dea21b", {
    imageAltEn: "Moving boxes and helpers",
    imageAltFr: "Boîtes de déménagement",
    accent: "hsl(30 70% 42%)",
    blurbEn: "Local moves, assembly, and installations.",
    blurbFr: "Déménagements locaux, assemblage et installations.",
  }),
  "security-inspection": visual("photo-1582139329536-e7284fece509", {
    imageAltEn: "Home locks and security",
    imageAltFr: "Serrures et sécurité à domicile",
    accent: "hsl(250 55% 42%)",
    lottie: "/lottie/security.json",
    blurbEn: "Inspections, locks, pests, and security systems.",
    blurbFr: "Inspections, serrures, extermination et sécurité.",
  }),
};

/** Popular service tile photos (HVAC = heating & AC outdoor unit). */
export const popularServicePhotoIds: Record<string, string> = {
  "plumbing-services": "photo-1607472586893-edb57bdc0e39",
  "electrical-services": "photo-1621905251189-08b45d6a269e",
  "house-cleaning": "photo-1581578731548-c64695cc6952",
  "hvac-services": "photo-1757800159710-080b937f517d",
  "bathroom-remodel": "photo-1552321554-5fefe8c9ef14",
};

export const popularServiceVisuals: Record<string, string> = Object.fromEntries(
  Object.entries(popularServicePhotoIds).map(([slug, id]) => [slug, unsplashUrl(id, 1600)])
);

export function popularServiceSrcSet(slug: string): string | undefined {
  const id = popularServicePhotoIds[slug];
  return id ? unsplashSrcSet(id) : undefined;
}

export function getCategoryVisual(slug: string): CategoryVisual {
  return (
    categoryVisuals[slug] ??
    visual("photo-1560518883-ce09059eeffa", {
      imageAltEn: "Local services",
      imageAltFr: "Services locaux",
      accent: "hsl(222 76% 32%)",
      blurbEn: "Browse trusted local professionals.",
      blurbFr: "Parcourez des professionnels locaux de confiance.",
    })
  );
}
