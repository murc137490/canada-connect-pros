import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "premiere-locale";

type Translations = (typeof translations)["en"];

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  /** True while the soft locale fade is running. */
  localeTransitioning: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === "fr" || stored === "en" ? stored : "fr";
  });
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale === "fr" ? "fr" : "en";
    }
  }, [locale]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;

      if (prefersReducedMotion()) {
        setLocaleState(next);
        setTransitioning(false);
        return;
      }

      setTransitioning(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);

      // Fade out → swap copy → fade in (site-wide, no hard cut).
      timerRef.current = window.setTimeout(() => {
        setLocaleState(next);
        timerRef.current = window.setTimeout(() => {
          setTransitioning(false);
          timerRef.current = undefined;
        }, 40);
      }, 170);
    },
    [locale]
  );

  const t = translations[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, localeTransitioning: transitioning }}>
      <div
        className={cn("locale-surface", transitioning && "locale-surface--out")}
        data-locale={locale}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
