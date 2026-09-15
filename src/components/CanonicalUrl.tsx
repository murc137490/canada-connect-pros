import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Preferred public URL for search engines and share cards (both domains serve the app). */
export const CANONICAL_ORIGIN = "https://www.altshift.ca";

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertMetaProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Always advertise www.altshift.ca as the canonical URL, even when the visitor
 * is on www.premiereservices.ca — so Google prefers AltShift in search results
 * while both domains keep working.
 */
export default function CanonicalUrl() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const path = `${pathname}${search}` || "/";
    const canonical = `${CANONICAL_ORIGIN}${path === "/" ? "/" : path}`;
    upsertLink("canonical", canonical);
    upsertMetaProperty("og:url", canonical);
  }, [pathname, search]);

  return null;
}
