import { useEffect, useState, type ReactNode } from "react";

/** True only when this browser can actually present Apple Pay (Safari + Wallet). */
export function isApplePayBrowserCapable(): boolean {
  if (typeof window === "undefined") return false;
  const ApplePaySession = (window as unknown as {
    ApplePaySession?: { canMakePayments?: () => boolean };
  }).ApplePaySession;
  if (!ApplePaySession) return false;
  try {
    return typeof ApplePaySession.canMakePayments === "function" && ApplePaySession.canMakePayments();
  } catch {
    return false;
  }
}

type ApplePayWalletSlotProps = {
  children: ReactNode;
  unavailableLabel: string;
  /** Opens QR handoff so Windows/Android users finish on iPhone Safari. */
  onRequestIphoneHandoff?: () => void;
  handoffButtonLabel?: string;
  className?: string;
};

/**
 * On Apple Safari + Wallet: render Square's Apple Pay control.
 * Everywhere else: show a clear Apple Pay button (QR handoff when provided).
 */
export function ApplePayWalletSlot({
  children,
  unavailableLabel,
  onRequestIphoneHandoff,
  handoffButtonLabel,
  className,
}: ApplePayWalletSlotProps) {
  const [capable, setCapable] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCapable(isApplePayBrowserCapable());
    setReady(true);
  }, []);

  const showLive = ready && capable;
  const label = handoffButtonLabel || "Apple Pay";

  return (
    <div className={className}>
      {showLive ? (
        children
      ) : (
        <button
          type="button"
          onClick={onRequestIphoneHandoff}
          disabled={!onRequestIphoneHandoff}
          title={unavailableLabel}
          aria-label={label}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-black px-3 text-[15px] font-semibold tracking-tight text-white ring-1 ring-white/25 transition enabled:hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-80"
        >
          <ApplePayMark />
          <span>{label}</span>
        </button>
      )}
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
