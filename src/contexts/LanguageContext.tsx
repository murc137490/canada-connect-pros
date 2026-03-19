import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/i18n/translations";
import { translations } from "@/i18n/translations";

const STORAGE_KEY = "premiere-locale";

type Translations = (typeof translations)["en"];

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored === "fr" || stored === "en" ? stored : "en";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);
  const t = translations[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
