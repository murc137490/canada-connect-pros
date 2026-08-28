import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type GooglePayWalletSlotProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Square’s Google Pay iframe paints white for a beat before the black button.
 * Keep a branded black cover on top (pointer-events: none) so clicks still hit
 * the real Google Pay control underneath, without the white flash.
 */
export function GooglePayWalletSlot({ children, className }: GooglePayWalletSlotProps) {
  return (
    <div
      className={cn(
        "sq-wallet-btn sq-google-pay-slot relative h-12 min-h-12 min-w-0 overflow-hidden rounded-[4px] ring-1 ring-white/25",
        className
      )}
    >
      <div className="sq-google-pay-sdk absolute inset-0 z-0 h-12 min-h-12 min-w-0">{children}</div>
      <div className="sq-google-pay-brand pointer-events-none absolute inset-0 z-[2]" aria-hidden>
        <GooglePayMark />
        <span className="whitespace-nowrap text-[15px] font-semibold leading-none tracking-tight text-white">
          Pay
        </span>
      </div>
    </div>
  );
}

function GooglePayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden className="shrink-0" style={{ display: "block" }}>
      <path
        fill="#4285F4"
        d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.1-2.7-.5-4z"
      />
      <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.6 2 8.3 6.8 6.3 14.7z" />
      <path fill="#FBBC05" d="M24 46c5.4 0 10.3-1.8 14.1-4.9l-6.5-5.3C29.5 37.3 26.9 38 24 38c-6 0-11.1-3.9-12.9-9.3l-7 5.4C7.1 41.1 14.9 46 24 46z" />
      <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.7-4.7 6.1l.1.1 6.5 5.3C40.5 37.3 46 31.5 46 24c0-1.3-.1-2.7-.5-4z" />
    </svg>
  );
}
