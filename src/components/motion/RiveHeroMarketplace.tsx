import { lazy, Suspense, useEffect, useState } from "react";
import MarketplaceMatchAnimation from "@/components/motion/MarketplaceMatchAnimation";
import type { MarketplaceMatchState } from "@/motion/types";
import { cn } from "@/lib/utils";

const RiveCanvas = lazy(() => import("@/components/motion/RiveCanvasLoader"));

const RIVE_SRC = "/rive/hero-marketplace.riv";

type Props = {
  state: MarketplaceMatchState;
  requestLabel?: string;
  className?: string;
  dark?: boolean;
};

/**
 * Hero marketplace visual.
 * Uses Rive when `/rive/hero-marketplace.riv` is present; otherwise the
 * SVG state-machine animation (same API / states).
 */
export default function RiveHeroMarketplace({ state, requestLabel, className, dark }: Props) {
  const [hasRive, setHasRive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(RIVE_SRC, { method: "HEAD" })
      .then((r) => {
        if (!cancelled) setHasRive(r.ok);
      })
      .catch(() => {
        if (!cancelled) setHasRive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hasRive) {
    return (
      <div className={cn("relative w-full max-w-[420px] mx-auto", className)}>
        <Suspense
          fallback={
            <MarketplaceMatchAnimation state={state} requestLabel={requestLabel} dark={dark} />
          }
        >
          <RiveCanvas src={RIVE_SRC} state={state} className="w-full aspect-[4/3]" />
        </Suspense>
      </div>
    );
  }

  return (
    <MarketplaceMatchAnimation
      state={state}
      requestLabel={requestLabel}
      className={className}
      dark={dark}
    />
  );
}
