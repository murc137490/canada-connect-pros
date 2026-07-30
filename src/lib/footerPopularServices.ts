/** Default footer “Popular” rows when browse stats are empty or RPC is unavailable. */
export const FOOTER_POPULAR_SERVICE_FALLBACK: readonly { category_slug: string; service_slug: string }[] = [
  { category_slug: "home-improvement", service_slug: "plumbing-services" },
  { category_slug: "outdoor-seasonal", service_slug: "snow-removal" },
  { category_slug: "cleaning", service_slug: "house-cleaning" },
  { category_slug: "moving", service_slug: "local-moving" },
] as const;
