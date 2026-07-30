/**
 * French translations for service subcategories and services.
 * Keys: subcategory = "categorySlug|subcategoryName", service = slug.
 */

import { BILINGUAL_SERVICES, toServiceSlug } from "@/data/services";

export const SERVICE_SUBCATEGORY_NAMES_FR: Record<string, string> = {
  "home-improvement|Renovation & additions": "Rénovations et agrandissements",
  "home-improvement|Plumbing": "Plomberie",
  "home-improvement|Electrical": "Électricité",
  "home-improvement|Heating & cooling": "Chauffage et climatisation",
  "home-improvement|Roofing": "Toiture",
  "home-improvement|Windows & doors": "Fenêtres et portes",
  "home-improvement|Flooring": "Revêtements de sol",
  "home-improvement|Painting": "Peinture",
  "home-improvement|Appliances": "Électroménagers",
  "outdoor-seasonal|Outdoor & seasonal": "Plein air et saisonnier",
  "cleaning|Cleaning services": "Services de nettoyage",
  "business|Business services": "Services aux entreprises",
  "events|Events": "Événements",
  "lessons|Lessons": "Cours et tutorat",
  "pets|Pet care": "Soins aux animaux",
  "wellness|Wellness": "Mieux-être",
  "moving|Moving & install": "Déménagement et installation",
  "security-inspection|Inspection & security": "Inspection et sécurité",
};

/** French display names by service slug (from bilingual catalog). */
export const SERVICE_NAMES_FR: Record<string, string> = Object.fromEntries(
  BILINGUAL_SERVICES.map(({ en, fr }) => [toServiceSlug(en), fr])
);

export function getSubcategoryName(catSlug: string, subName: string, locale: "en" | "fr"): string {
  if (locale !== "fr") return subName;
  const key = `${catSlug}|${subName}`;
  return SERVICE_SUBCATEGORY_NAMES_FR[key] ?? subName;
}

export function getServiceName(serviceSlug: string, locale: "en" | "fr", fallbackName?: string): string {
  if (locale !== "fr") return fallbackName ?? serviceSlug;
  return SERVICE_NAMES_FR[serviceSlug] ?? fallbackName ?? serviceSlug;
}
