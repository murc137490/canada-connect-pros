import type { ProPlanId } from "@/lib/proPlanPreview";

export type PwaIconTier = "client" | ProPlanId;

export type PwaIconTheme = {
  id: PwaIconTier;
  themeColor: string;
  backgroundColor: string;
  appleTouch: string;
  /** Static file under /public — Android needs a real URL, not a blob: manifest. */
  manifestHref: string;
};

export const PWA_ICON_THEMES: Record<PwaIconTier, PwaIconTheme> = {
  client: {
    id: "client",
    themeColor: "#0a0a0a",
    backgroundColor: "#0a0a0a",
    appleTouch: "/pwa-client-apple-touch.png",
    manifestHref: "/manifest-client.webmanifest",
  },
  starter: {
    id: "starter",
    themeColor: "#1e3a8a",
    backgroundColor: "#0f172a",
    appleTouch: "/pwa-starter-apple-touch.png",
    manifestHref: "/manifest-starter.webmanifest",
  },
  growth: {
    id: "growth",
    themeColor: "#047857",
    backgroundColor: "#022c22",
    appleTouch: "/pwa-growth-apple-touch.png",
    manifestHref: "/manifest-growth.webmanifest",
  },
  pro: {
    id: "pro",
    themeColor: "#6d28d9",
    backgroundColor: "#1e1b4b",
    appleTouch: "/pwa-pro-apple-touch.png",
    manifestHref: "/manifest-pro.webmanifest",
  },
};

export function resolvePwaIconTier(paidTier: ProPlanId | null | undefined): PwaIconTier {
  if (paidTier === "starter" || paidTier === "growth" || paidTier === "pro") return paidTier;
  return "client";
}

function abs(path: string): string {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

/** Update apple-touch-icon + web manifest for the current user’s tier (before install). */
export function applyPwaIconTheme(tier: PwaIconTier) {
  if (typeof document === "undefined") return;
  const theme = PWA_ICON_THEMES[tier] ?? PWA_ICON_THEMES.client;

  let apple = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  // Absolute URL — some WebViews resolve relative links against the wrong base.
  apple.href = abs(theme.appleTouch);

  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = theme.themeColor;
  document.head.appendChild(meta);

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  // Bust caches so Android Chrome re-reads icons after deploy / tier change.
  link.href = `${theme.manifestHref}?v=4`;
}
