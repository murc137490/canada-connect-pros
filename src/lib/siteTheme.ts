export type SiteTheme = "dark" | "cream" | "light";

const SITE_THEMES: SiteTheme[] = ["light", "cream", "dark"];

export function getActiveSiteTheme(fallback: SiteTheme = "light"): SiteTheme {
  if (typeof document === "undefined") return fallback;

  const root = document.documentElement;
  // Prefer the applied class: it is the source of truth for the colors currently
  // visible, even while next-themes is still updating its React state.
  if (root.classList.contains("cream")) return "cream";
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return fallback;
}

export function cycleSiteTheme(current: SiteTheme): SiteTheme {
  const index = SITE_THEMES.indexOf(current);
  return SITE_THEMES[(index + 1) % SITE_THEMES.length];
}

export function applySiteTheme(next: SiteTheme, setTheme: (theme: string) => void): void {
  const root = document.documentElement;
  // Apply immediately, and let next-themes persist/synchronize the same value.
  root.classList.remove(...SITE_THEMES);
  root.classList.add(next);
  root.style.colorScheme = next === "dark" ? "dark" : "light";
  try {
    localStorage.setItem("altshift-theme", next);
  } catch {
    // Theme remains applied for this page even if storage is unavailable.
  }
  setTheme(next);
}
