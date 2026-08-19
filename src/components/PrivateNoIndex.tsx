import { useEffect } from "react";

/** Sets noindex/nofollow for private app surfaces (dashboard, admin, auth-sensitive). */
export default function PrivateNoIndex() {
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]');
    const prev = existing?.getAttribute("content") ?? null;
    let meta = existing as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow";
    return () => {
      if (!meta) return;
      if (prev == null) meta.remove();
      else meta.content = prev;
    };
  }, []);
  return null;
}
