/**
 * Production: mute browser console noise so stack traces / internals
 * are not casually visible in DevTools Console.
 *
 * Note: Network tab responses cannot be hidden from a determined user;
 * edge functions must return non-sensitive JSON. This only covers console.*.
 */

export function silenceClientDiagnostics(): void {
  if (import.meta.env.DEV) return;
  if (typeof window === "undefined") return;

  const noop = () => {};
  try {
    // Keep console intact for emergency overrides only via __premiereAllowLogs
    const w = window as Window & { __premiereAllowLogs?: boolean };
    if (w.__premiereAllowLogs) return;

    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.error = noop;
  } catch {
    /* ignore */
  }
}
