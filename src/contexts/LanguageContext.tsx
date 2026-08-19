import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/translations";
import { translations } from "@/i18n/translations";
import { cn } from "@/lib/utils";
import { getCookieConsent, isCookieAllowed } from "@/lib/cookieConsent";

const STORAGE_KEY = "premiere-locale";
const COOKIE_NAME = "premiere-locale";

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

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )premiere-locale=(fr|en)(?:;|$)/);
  return match?.[1] === "en" || match?.[1] === "fr" ? match[1] : null;
}

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  // Preferences cookie — only persist when user allowed preferences (or has not decided yet / legacy).
  const consent = getCookieConsent();
  if (consent && !isCookieAllowed("preferences")) return;
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * First visit = French.
 * Later visits: use saved locale from localStorage or cookie (user choice).
 * Never auto-switch to English from browser language alone.
 */
function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "fr";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  const fromCookie = readLocaleCookie();
  if (fromCookie) return fromCookie;
  return "fr";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    writeLocaleCookie(locale);
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
        className={cn(
          "locale-surface min-h-screen w-full max-w-none",
          transitioning && "locale-surface--out"
        )}
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
