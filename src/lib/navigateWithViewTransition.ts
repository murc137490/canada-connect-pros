import type { NavigateFunction, To } from "react-router-dom";

/** Client-side navigation wrapped in View Transitions when supported (smoother route changes). */
export function navigateWithViewTransition(
  navigate: NavigateFunction,
  to: To,
  options?: Parameters<NavigateFunction>[1]
): void {
  const go = () => navigate(to, options);
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(go);
  } else {
    go();
  }
}
