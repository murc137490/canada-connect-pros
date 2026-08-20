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

type ApplePayWalletSlotProps = {
  children: ReactNode;
  unavailableLabel: string;
  /** Opens QR handoff so Windows/Android users finish on iPhone Safari (Square path). */
  onRequestIphoneHandoff?: () => void;
  handoffButtonLabel?: string;
  className?: string;
};

/**
 * Always mounts the provider Apple Pay control (Square `<ApplePay>`).
 * After Apple Pay JS loads, if the SDK button appears (Safari sheet or provider
 * QR), we show it. Otherwise we fall back to the Première QR handoff button when
 * `onRequestIphoneHandoff` is provided.
 *
 * Square documents Safari-first Apple Pay; native Apple QR on Chrome/Windows is
 * officially supported by Stripe Express Checkout (`applePay: 'always'`). With
 * Square we keep QR → iPhone Safari until Square ships equivalent support.
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

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    void (async () => {
      await ensureApplePaySdkLoaded();
      if (cancelled) return;
      await resolveApplePayBrowserCapable();
      if (cancelled) return;
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
  const showFallback = ready && !sdkLive;

  return (
    <div className={`relative min-h-12 ${className ?? ""}`.trim()}>
      {/* Keep a real layout box so Square can measure/mount the wallet control. */}
      <div
        ref={slotRef}
        className={`min-h-12 min-w-0 ${sdkLive ? "" : "invisible absolute inset-0"}`}
        aria-hidden={!sdkLive}
      >
        {children}
      </div>

      {!ready ? (
        <div
          className="flex h-12 w-full items-center justify-center rounded-[4px] bg-black ring-1 ring-white/25"
          aria-hidden
        >
          <span className="text-xs text-white/60">…</span>
        </div>
      ) : null}

      {showFallback && onRequestIphoneHandoff ? (
        <button
          type="button"
          onClick={onRequestIphoneHandoff}
          title={unavailableLabel}
          aria-label={label}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-black px-3 text-[15px] font-semibold tracking-tight text-white ring-1 ring-white/25 transition hover:bg-neutral-900"
        >
          <ApplePayMark />
          <span>{label}</span>
        </button>
      ) : null}

      {showFallback && !onRequestIphoneHandoff ? (
        <button
          type="button"
          disabled
          title={unavailableLabel}
          aria-label={label}
          className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[4px] bg-black px-3 text-[15px] font-semibold tracking-tight text-white opacity-80 ring-1 ring-white/25"
        >
          <ApplePayMark />
          <span>{label}</span>
        </button>
      ) : null}
    </div>
  );
}

function ApplePayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 fill-white">
      <path d="M17.05 12.25c-.03-2.18 1.78-3.23 1.86-3.28-1.01-1.48-2.59-1.68-3.15-1.7-1.34-.14-2.62.79-3.3.79-.69 0-1.75-.77-2.88-.75-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.61 2.25 2.76 2.21 1.11-.05 1.53-.72 2.87-.72 1.33 0 1.71.72 2.88.7 1.19-.02 1.95-1.08 2.68-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.35-3.6zM14.7 5.98c.61-.74 1.02-1.77.91-2.8-.88.04-1.95.59-2.58 1.33-.56.65-1.06 1.7-.93 2.7.98.08 1.99-.5 2.6-1.23z" />
    </svg>
  );
}
