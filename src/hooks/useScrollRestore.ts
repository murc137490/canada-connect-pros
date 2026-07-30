import { useEffect, useLayoutEffect } from "react";

/**
 * Saves `window.scrollY` to sessionStorage when the component unmounts (e.g. navigating away),
 * and restores it on the next mount (e.g. browser Back). Use a stable key per logical page.
 */
export function useScrollRestore(storageKey: string) {
  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw != null) {
        const y = parseInt(raw, 10);
        if (!Number.isNaN(y)) requestAnimationFrame(() => window.scrollTo(0, y));
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(storageKey, String(window.scrollY));
      } catch {
        /* ignore */
      }
    };
  }, [storageKey]);
}
