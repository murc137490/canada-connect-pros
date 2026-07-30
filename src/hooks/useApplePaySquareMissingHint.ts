import { useEffect, useState, type RefObject } from "react";

function applePayJsPresent(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { ApplePaySession?: unknown }).ApplePaySession !== "undefined";
}

function applePaySlotLooksEmpty(el: HTMLElement): boolean {
  if (el.querySelector("iframe, button, [role='button'], apple-pay-button")) return false;
  return el.getBoundingClientRect().height < 36;
}

/**
 * On Safari / Apple Pay–capable environments only: after Square mounts, show a short beta hint
 * if the Apple Pay wallet slot still looks empty (domain / merchant config / SDK).
 */
export function useApplePaySquareMissingHint(anchorRef: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    if (!applePayJsPresent()) {
      setShow(false);
      return;
    }

    let cancelled = false;
    const delaysMs = [1400, 2800, 4800];
    const timers: number[] = [];

    const tick = () => {
      if (cancelled) return;
      const el = anchorRef.current;
      if (!el) return;
      if (applePaySlotLooksEmpty(el)) setShow(true);
      else {
        setShow(false);
      }
    };

    for (const ms of delaysMs) {
      timers.push(window.setTimeout(tick, ms));
    }

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [active]);

  return show;
}
