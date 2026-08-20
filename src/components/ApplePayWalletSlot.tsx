import { useEffect, useState, type ReactNode } from "react";

export function isApplePayBrowserCapable(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { ApplePaySession?: unknown }).ApplePaySession !== "undefined";
}

type ApplePayWalletSlotProps = {
  children: ReactNode;
  unavailableLabel: string;
  /** When set, the non-Apple placeholder becomes a button that starts iPhone QR handoff. */
  onRequestIphoneHandoff?: () => void;
  handoffButtonLabel?: string;
  className?: string;
};

/**
 * Apple Pay on the web only works in Safari on Apple devices with Wallet.
 * On Windows/Android we show a black Apple Pay button that can open a QR
 * handoff so the user finishes on iPhone Safari.
 */
export function ApplePayWalletSlot({
  children,
  unavailableLabel,
  onRequestIphoneHandoff,
  handoffButtonLabel,
  className,
}: ApplePayWalletSlotProps) {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    setCapable(isApplePayBrowserCapable());
  }, []);

  return (
    <div className={className}>
      {capable ? (
        children
      ) : onRequestIphoneHandoff ? (
        <button
          type="button"
          onClick={onRequestIphoneHandoff}
          title={unavailableLabel}
          aria-label={handoffButtonLabel || unavailableLabel}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black px-3 text-[15px] font-medium text-white transition hover:bg-neutral-900"
        >
          <ApplePayMark />
          <span className="tracking-tight">{handoffButtonLabel || "Apple Pay"}</span>
        </button>
      ) : (
        <button
          type="button"
          disabled
          title={unavailableLabel}
          aria-label={unavailableLabel}
          className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-black px-3 text-[15px] font-medium text-white opacity-90"
        >
          <ApplePayMark />
          <span className="tracking-tight">Apple Pay</span>
        </button>
      )}
    </div>
  );
}

function ApplePayMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="currentColor"
        d="M17.05 12.25c-.03-2.18 1.78-3.23 1.86-3.28-1.01-1.48-2.59-1.68-3.15-1.7-1.34-.14-2.62.79-3.3.79-.69 0-1.75-.77-2.88-.75-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.61 2.25 2.76 2.21 1.11-.05 1.53-.72 2.87-.72 1.33 0 1.71.72 2.88.7 1.19-.02 1.95-1.08 2.68-2.15.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.32-.89-2.35-3.6zM14.7 5.98c.61-.74 1.02-1.77.91-2.8-.88.04-1.95.59-2.58 1.33-.56.65-1.06 1.7-.93 2.7.98.08 1.99-.5 2.6-1.23z"
      />
    </svg>
  );
}
