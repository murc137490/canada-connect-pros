import type { ProPlanId } from "@/lib/proPlanPreview";

export type PwaIconTier = "client" | ProPlanId;

/** Persist so Android can restore the tier icon before auth finishes. */
export const BRAND_TIER_STORAGE_KEY = "altshift-brand-tier";

/** Bump when icon assets change so Android/Chrome drop cached glyphs. */
export const BRAND_ICON_CACHE_VER = "10";

export type PwaIconTheme = {
  id: PwaIconTier;
  themeColor: string;
  backgroundColor: string;
  appleTouch: string;
  icon192: string;
  icon512: string;
  faviconIco: string;
  favicon32: string;
  favicon64: string;
  favicon192: string;
  /** Transparent A cutout — bright S for dark surfaces. */
  brandLogo: string;
  /** Transparent A cutout — darker S for light surfaces. */
  brandLogoOnLight: string;
  manifestHref: string;
};

export const PWA_ICON_THEMES: Record<PwaIconTier, PwaIconTheme> = {
  client: {
    id: "client",
    themeColor: "#0a0a0a",
    backgroundColor: "#0a0a0a",
    appleTouch: "/pwa-client-apple-touch.png",
    icon192: "/pwa-client-192x192.png",
    icon512: "/pwa-client-512x512.png",
    faviconIco: "/favicon-client.ico",
    favicon32: "/favicon-client-32.png",
    favicon64: "/favicon-client-64.png",
    favicon192: "/favicon-client-192.png",
    brandLogo: "/brand-logo-client.png",
    brandLogoOnLight: "/brand-logo-client-on-light.png",
    manifestHref: "/manifest-client.webmanifest",
  },
  starter: {
    id: "starter",
    themeColor: "#1e3a8a",
    backgroundColor: "#0f172a",
    appleTouch: "/pwa-starter-apple-touch.png",
    icon192: "/pwa-starter-192x192.png",
    icon512: "/pwa-starter-512x512.png",
    faviconIco: "/favicon-starter.ico",
    favicon32: "/favicon-starter-32.png",
    favicon64: "/favicon-starter-64.png",
    favicon192: "/favicon-starter-192.png",
    brandLogo: "/brand-logo-starter.png",
    brandLogoOnLight: "/brand-logo-starter-on-light.png",
    manifestHref: "/manifest-starter.webmanifest",
  },
  growth: {
    id: "growth",
    themeColor: "#047857",
    backgroundColor: "#022c22",
    appleTouch: "/pwa-growth-apple-touch.png",
    icon192: "/pwa-growth-192x192.png",
    icon512: "/pwa-growth-512x512.png",
    faviconIco: "/favicon-growth.ico",
    favicon32: "/favicon-growth-32.png",
    favicon64: "/favicon-growth-64.png",
    favicon192: "/favicon-growth-192.png",
    brandLogo: "/brand-logo-growth.png",
    brandLogoOnLight: "/brand-logo-growth-on-light.png",
    manifestHref: "/manifest-growth.webmanifest",
  },
  pro: {
    id: "pro",
    themeColor: "#6d28d9",
    backgroundColor: "#1e1b4b",
    appleTouch: "/pwa-pro-apple-touch.png",
    icon192: "/pwa-pro-192x192.png",
    icon512: "/pwa-pro-512x512.png",
    faviconIco: "/favicon-pro.ico",
    favicon32: "/favicon-pro-32.png",
    favicon64: "/favicon-pro-64.png",
    favicon192: "/favicon-pro-192.png",
    brandLogo: "/brand-logo-pro.png",
    brandLogoOnLight: "/brand-logo-pro-on-light.png",
    manifestHref: "/manifest-pro.webmanifest",
  },
};

export function resolvePwaIconTier(paidTier: ProPlanId | null | undefined): PwaIconTier {
  if (paidTier === "starter" || paidTier === "growth" || paidTier === "pro") return paidTier;
  return "client";
}

export function readStoredBrandTier(): PwaIconTier {
  try {
    const raw = localStorage.getItem(BRAND_TIER_STORAGE_KEY);
    if (raw === "starter" || raw === "growth" || raw === "pro" || raw === "client") return raw;
  } catch {
    /* ignore */
  }
  return "client";
}

export function writeStoredBrandTier(tier: PwaIconTier) {
  try {
    localStorage.setItem(BRAND_TIER_STORAGE_KEY, tier);
  } catch {
    /* ignore */
  }
}

function abs(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

function cacheUrl(path: string): string {
  const base = abs(path);
  const join = base.includes("?") ? "&" : "?";
  return `${base}${join}v=${BRAND_ICON_CACHE_VER}`;
}

function upsertIconLink(attrs: { rel: string; sizes?: string; type?: string; href: string }) {
  let el: HTMLLinkElement | null = null;
  if (attrs.sizes) {
    el = document.querySelector<HTMLLinkElement>(`link[rel="${attrs.rel}"][sizes="${attrs.sizes}"]`);
  } else if (attrs.href.endsWith(".ico")) {
    el =
      document.querySelector<HTMLLinkElement>(`link[rel="${attrs.rel}"][href*=".ico"]`) ??
      document.querySelector<HTMLLinkElement>(`link[rel="${attrs.rel}"]:not([sizes])`);
  } else {
    el = document.querySelector<HTMLLinkElement>(`link[rel="${attrs.rel}"]:not([sizes])`);
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = attrs.rel;
    if (attrs.sizes) el.setAttribute("sizes", attrs.sizes);
    document.head.appendChild(el);
  }
  if (attrs.type) el.type = attrs.type;
  el.href = cacheUrl(attrs.href);
}

/**
 * Apply tier chrome sitewide.
 * Forces a fresh <link rel="manifest"> so Android Chrome/Samsung re-read tier icons
 * before Add to Home screen.
 */
export function applyPwaIconTheme(tier: PwaIconTier) {
  if (typeof document === "undefined") return;
  const theme = PWA_ICON_THEMES[tier] ?? PWA_ICON_THEMES.client;

  upsertIconLink({ rel: "icon", href: theme.faviconIco, type: "image/x-icon" });
  upsertIconLink({ rel: "icon", sizes: "32x32", type: "image/png", href: theme.favicon32 });
  upsertIconLink({ rel: "icon", sizes: "64x64", type: "image/png", href: theme.favicon64 });
  // Opaque install icons — Android ignores transparent cutouts for homescreen
  upsertIconLink({ rel: "icon", sizes: "192x192", type: "image/png", href: theme.icon192 });
  upsertIconLink({ rel: "icon", sizes: "512x512", type: "image/png", href: theme.icon512 });

  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = cacheUrl(theme.appleTouch);

  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = theme.themeColor;
  document.head.appendChild(meta);

  const root = document.documentElement;
  if (tier === "client") {
    root.style.removeProperty("--pwa-chrome-color");
    root.removeAttribute("data-pwa-tier");
  } else {
    root.style.setProperty("--pwa-chrome-color", theme.themeColor);
    root.dataset.pwaTier = tier;
  }

  // Remount manifest link — required for Android to pick up a different tier's icons
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = `${abs(theme.manifestHref)}?v=${BRAND_ICON_CACHE_VER}&t=${tier}`;
  document.head.appendChild(link);
}
