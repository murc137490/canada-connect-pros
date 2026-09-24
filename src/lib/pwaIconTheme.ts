import type { ProPlanId } from "@/lib/proPlanPreview";

export type PwaIconTier = "client" | ProPlanId;

export type PwaIconTheme = {
  id: PwaIconTier;
  themeColor: string;
  backgroundColor: string;
  appleTouch: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: "any" | "maskable" }>;
};

const BASE_MANIFEST = {
  name: "AltShift",
  short_name: "AltShift",
  description:
    "Describe your need and receive quotes from trusted local service professionals across Quebec and Canada.",
  display: "standalone",
  orientation: "any",
  start_url: "/",
  scope: "/",
  id: "/",
  lang: "fr",
  dir: "ltr",
  categories: ["business", "lifestyle"],
} as const;

function themeFor(id: PwaIconTier, themeColor: string, backgroundColor: string): PwaIconTheme {
  const prefix = `/pwa-${id}`;
  return {
    id,
    themeColor,
    backgroundColor,
    appleTouch: `${prefix}-apple-touch.png`,
    icons: [
      { src: `${prefix}-192x192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${prefix}-512x512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${prefix}-maskable-192x192.png`, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: `${prefix}-maskable-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

export const PWA_ICON_THEMES: Record<PwaIconTier, PwaIconTheme> = {
  client: themeFor("client", "#0a0a0a", "#0a0a0a"),
  starter: themeFor("starter", "#1e3a8a", "#0f172a"),
  growth: themeFor("growth", "#047857", "#022c22"),
  pro: themeFor("pro", "#6d28d9", "#1e1b4b"),
};

export function resolvePwaIconTier(paidTier: ProPlanId | null | undefined): PwaIconTier {
  if (paidTier === "starter" || paidTier === "growth" || paidTier === "pro") return paidTier;
  return "client";
}

let manifestObjectUrl: string | null = null;

/** Update apple-touch-icon + web manifest icons for the current user’s tier (before install). */
export function applyPwaIconTheme(tier: PwaIconTier) {
  if (typeof document === "undefined") return;
  const theme = PWA_ICON_THEMES[tier] ?? PWA_ICON_THEMES.client;

  // Apple home-screen icon
  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = theme.appleTouch;

  // Theme color meta (status bar / install chrome)
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = theme.themeColor;
  document.head.appendChild(meta);

  const manifest = {
    ...BASE_MANIFEST,
    theme_color: theme.themeColor,
    background_color: theme.backgroundColor,
    icons: theme.icons,
  };

  if (manifestObjectUrl) {
    URL.revokeObjectURL(manifestObjectUrl);
    manifestObjectUrl = null;
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  manifestObjectUrl = URL.createObjectURL(blob);

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = manifestObjectUrl;
}
