import { useEffect, useState, type RefObject } from "react";
import {
  applePaySlotLooksLive,
  ensureApplePaySdkLoaded,
  isApplePayBrowserCapableSync,
} from "@/lib/applePaySdk";

/**
 * On Apple Pay–capable environments only: after Square mounts, show a short beta hint
 * if the Apple Pay wallet slot still looks empty (domain / merchant config / SDK).
 */
export function useApplePaySquareMissingHint(anchorRef: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }

    let cancelled = false;
    const delaysMs = [1400, 2800, 4800];
    const timers: number[] = [];

    void (async () => {
      await ensureApplePaySdkLoaded();
      if (cancelled || !isApplePayBrowserCapableSync()) {
        if (!cancelled) setShow(false);
        return;
      }

      const tick = () => {
        if (cancelled) return;
        const el = anchorRef.current;
        if (!el) return;
        setShow(!applePaySlotLooksLive(el));
      };

      for (const ms of delaysMs) {
        timers.push(window.setTimeout(tick, ms));
      }
      tick();
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [active, anchorRef]);

  return show;
}
