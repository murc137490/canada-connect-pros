import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  applePaySlotLooksLive,
  ensureApplePaySdkLoaded,
  isApplePayBrowserCapableSync,
  resolveApplePayBrowserCapable,
} from "@/lib/applePaySdk";

/** @deprecated Prefer resolveApplePayBrowserCapable — kept for call sites. */
export function isApplePayBrowserCapable(): boolean {
  return isApplePayBrowserCapableSync();
}

/** True Safari (not Chrome/Firefox/Edge). Native Apple Pay button paints the logo here. */
export function isAppleSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|edg|firefox|fxios|android/i.test(ua);
}

type ApplePayWalletSlotProps = {
  children: ReactNode;
  unavailableLabel: string;
  /** Opens Première QR handoff only when Square Apple Pay cannot mount. */
  onRequestIphoneHandoff?: () => void;
  handoffButtonLabel?: string;
  className?: string;
};

const btnBase =
  "flex h-12 w-full flex-row flex-nowrap items-center justify-center gap-2 rounded-[4px] bg-black px-3 text-[15px] font-semibold tracking-tight text-white ring-1 ring-white/25";

/**
 * Prefer Square `<ApplePay>` whenever Apple Pay JS reports capability
 * (Safari sheet, or Apple’s native Windows/Chrome QR).
 * Branded overlay outside Safari (Square’s CSS button is otherwise blank).
 * Première QR handoff only if Square never mounts.
 */
export function ApplePayWalletSlot({
  children,
  unavailableLabel,
  onRequestIphoneHandoff,
  handoffButtonLabel,
  className,
}: ApplePayWalletSlotProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [sdkLive, setSdkLive] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    void (async () => {
      await ensureApplePaySdkLoaded();
      if (cancelled) return;
      await resolveApplePayBrowserCapable();
      if (cancelled) return;
      setIsSafari(isAppleSafariBrowser());
      setReady(true);

      const probe = () => {
        if (cancelled) return;
        setSdkLive(applePaySlotLooksLive(slotRef.current));
      };
      for (const ms of [400, 1200, 2400, 4000, 6500]) {
        timers.push(window.setTimeout(probe, ms));
      }
      probe();
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const label = handoffButtonLabel || "Apple Pay";
  const showHandoff = ready && !sdkLive && !!onRequestIphoneHandoff;
  const showDisabled = ready && !sdkLive && !onRequestIphoneHandoff;
  const showOverlay = sdkLive && !isSafari;

  return (
    <div className={`relative h-12 min-h-12 w-full ${className ?? ""}`.trim()}>
      {/* Always mount Square Apple Pay so Windows can open Apple’s native QR when capable. */}
      <div
        ref={slotRef}
        className={`h-12 min-h-12 min-w-0 ${sdkLive ? "" : "invisible absolute inset-0"}`}
        aria-hidden={!sdkLive}
      >
        {children}
      </div>

      {showOverlay ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] flex flex-row flex-nowrap items-center justify-center gap-2 rounded-[4px] bg-black text-white ring-1 ring-white/25"
          aria-hidden
        >
          <ApplePayMark />
          <span className="whitespace-nowrap text-[15px] font-semibold leading-none tracking-tight">Pay</span>
        </div>
      ) : null}

      {!ready ? (
        <div className={`${btnBase} opacity-80`} aria-hidden>
          <span className="text-xs text-white/60">…</span>
        </div>
      ) : null}

      {showHandoff ? (
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

      {showDisabled ? (
        <button type="button" disabled title={unavailableLabel} aria-label={label} className={`${btnBase} cursor-not-allowed opacity-80`}>
          <ApplePayMark />
          <span className="whitespace-nowrap leading-none">Pay</span>
        </button>
      ) : null}
    </div>
  );
}

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
