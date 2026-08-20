/**
 * Apple Pay JS SDK (1.2+) enables Apple Pay on non-Safari desktop browsers
 * via Apple's built-in QR → iPhone (iOS 18+) handoff when the payment provider
 * uses the Apple Pay JS API correctly.
 *
 * Square's Web Payments SDK still primarily documents Safari; we load Apple's
 * script so capability checks and any Square/Apple interop can see ApplePaySession.
 */

const APPLE_PAY_SDK_SRC = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";

type ApplePaySessionStatic = {
  canMakePayments?: () => boolean;
  applePayCapabilities?: (
    merchantIdentifier: string,
  ) => Promise<{ paymentCredentialStatus?: string }>;
};

function getApplePaySession(): ApplePaySessionStatic | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ApplePaySession?: ApplePaySessionStatic }).ApplePaySession;
}

let loadPromise: Promise<boolean> | null = null;

/** Inject Apple Pay JS SDK once (safe to call from multiple components). */
export function ensureApplePaySdkLoaded(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (getApplePaySession()) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${APPLE_PAY_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(!!getApplePaySession()));
      existing.addEventListener("error", () => resolve(false));
      // Already loaded earlier in this page life
      if (getApplePaySession()) resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = APPLE_PAY_SDK_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(!!getApplePaySession());
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * True when this browser can present Apple Pay (Safari Wallet, or Apple Pay JS
 * on a third-party desktop browser that supports QR handoff).
 */
export function isApplePayBrowserCapableSync(): boolean {
  const ApplePaySession = getApplePaySession();
  if (!ApplePaySession) return false;
  try {
    return typeof ApplePaySession.canMakePayments === "function" && ApplePaySession.canMakePayments();
  } catch {
    return false;
  }
}

export async function resolveApplePayBrowserCapable(): Promise<boolean> {
  await ensureApplePaySdkLoaded();
  return isApplePayBrowserCapableSync();
}

/** Detect whether Square (or Apple) actually mounted a live wallet control. */
export function applePaySlotLooksLive(el: HTMLElement | null | undefined): boolean {
  if (!el) return false;
  if (el.querySelector("iframe, button, [role='button'], apple-pay-button")) return true;

  // Square's ApplePayContainer uses -webkit-appearance: -apple-pay-button and
  // stays display:none until payments.applePay() succeeds.
  for (const node of Array.from(el.querySelectorAll<HTMLElement>("*"))) {
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const h = node.getBoundingClientRect().height;
    if (h >= 36 && (String(cs.getPropertyValue("-webkit-appearance") || "").includes("apple-pay") || node.id.includes("apple-pay"))) {
      return true;
    }
  }
  return false;
}
