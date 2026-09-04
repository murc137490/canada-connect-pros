import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to #how-it-works (and other hash targets) after client-side navigations. */
export default function HashScroll() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash || hash.length < 2) return;
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    if (!id) return;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(tryScroll, 50);
    };

    const t = window.setTimeout(tryScroll, 0);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);

  return null;
}
