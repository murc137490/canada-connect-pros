import { useEffect, useState, type ReactNode } from "react";
import {
  ensureApplePaySdkLoaded,
  isApplePayBrowserCapableSync,
  resolveApplePayBrowserCapable,
} from "@/lib/applePaySdk";

/** @deprecated Prefer resolveApplePayBrowserCapable — kept for call sites. */
export function isApplePayBrowserCapable(): boolean {
  return isApplePayBrowserCapableSync();
}

/** True Safari (not Chrome/Firefox/Edge/iOS Chrome). Square's Apple Pay button paints correctly here. */
export function isAppleSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|edg|firefox|fxios|android/i.test(ua);
}

type ApplePayWalletSlotProps = {
  children: ReactNode;
  unavailableLabel: string;
  /** Opens QR handoff so Windows/Android users finish on iPhone Safari (Square path). */
  onRequestIphoneHandoff?: () => void;
  handoffButtonLabel?: string;
  className?: string;
};

const btnBase =
  "flex h-12 w-full flex-row flex-nowrap items-center justify-center gap-2 rounded-[4px] bg-black px-3 text-[15px] font-semibold tracking-tight text-white ring-1 ring-white/25";

/**
 * Safari + Wallet: mount Square `<ApplePay>` (native sheet).
 * Everyone else: branded Apple Pay button → Première QR handoff (iPhone Safari).
 *
 * Do NOT mount Square Apple Pay on Windows/Chrome — Apple's native QR often shows
 * the amount then dismisses (merchant validation), and Square's CSS button paints
 * as a blank/broken black box outside Safari.
 */
export function ApplePayWalletSlot({
  children,
  unavailableLabel,
  onRequestIphoneHandoff,
  handoffButtonLabel,
  className,
}: ApplePayWalletSlotProps) {
  const [ready, setReady] = useState(false);
  const [useSquareNative, setUseSquareNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureApplePaySdkLoaded();
      if (cancelled) return;
      const capable = await resolveApplePayBrowserCapable();
      if (cancelled) return;
      setUseSquareNative(isAppleSafariBrowser() && capable);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const label = handoffButtonLabel || "Apple Pay";

  return (
    <div className={`h-12 min-h-12 w-full ${className ?? ""}`.trim()}>
      {!ready ? (
        <div className={`${btnBase} opacity-80`} aria-hidden>
          <span className="text-xs text-white/60">…</span>
        </div>
      ) : null}

      {ready && useSquareNative ? children : null}

      {ready && !useSquareNative && onRequestIphoneHandoff ? (
        <button
          type="button"
          onClick={onRequestIphoneHandoff}
          title={unavailableLabel}
          aria-label={label}
          className={`${btnBase} transition hover:bg-neutral-900`}
        >
          <ApplePayMark />
          <span className="whitespace-nowrap leading-none">Pay</span>
        </button>
      ) : null}

      {ready && !useSquareNative && !onRequestIphoneHandoff ? (
        <button
          type="button"
          disabled
          title={unavailableLabel}
          aria-label={label}
          className={`${btnBase} cursor-not-allowed opacity-80`}
        >
          <ApplePayMark />
          <span className="whitespace-nowrap leading-none">Pay</span>
        </button>
      ) : null}
    </div>
  );
}

/** Apple logo mark — kept inline with "Pay" (official-style black button). */
function ApplePayMark() {
  return (
    <svg
      width="18"
      height="22"
      viewBox="0 0 17 21"
      aria-hidden="true"
      className="shrink-0 fill-white"
      style={{ display: "block" }}
    >
      <path d="M13.97 11.12c-.02-2.05 1.67-3.04 1.75-3.09-.95-1.39-2.44-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.64-.72-2.7-.7-1.39.02-2.68.81-3.39 2.06-1.45 2.51-.37 6.23 1.04 8.27.69 1 1.51 2.12 2.59 2.08 1.04-.05 1.44-.67 2.7-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.02 2.52-2.02.79-1.16 1.12-2.28 1.14-2.34-.02-.01-2.18-.84-2.2-3.38zM11.76 5.23c.57-.7.96-1.66.85-2.63-.83.03-1.83.55-2.42 1.25-.53.61-1 .1.6-.87 2.54.92.07 1.87-.47 2.44-1.16z" />
    </svg>
  );
}
