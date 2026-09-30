import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { applyDocumentMeta, resolveRouteMeta } from "@/lib/routeMeta";

/**
 * Per-route document title, description, Open Graph tags, and canonical URL.
 * html lang is set by the boot script and LanguageProvider.
 */
export default function DocumentHead() {
  const { pathname } = useLocation();
  const { locale } = useLanguage();

  useEffect(() => {
    applyDocumentMeta(resolveRouteMeta(pathname, locale), locale);
  }, [pathname, locale]);

  return null;
}
