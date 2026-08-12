import { useEffect } from "react";
import { useRive, useStateMachineInput } from "@rive-app/react-canvas";
import type { MarketplaceMatchState } from "@/motion/types";

type Props = {
  src: string;
  state: MarketplaceMatchState;
  className?: string;
  /** State machine name in the .riv file (default: Marketplace) */
  stateMachine?: string;
};

/**
 * Thin Rive loader. Expects a state machine with a Number input `phase`:
 * 0 idle · 1 hover · 2 request · 3 searching · 4 matching · 5 matched · 6 success
 */
export default function RiveCanvasLoader({
  src,
  state,
  className,
  stateMachine = "Marketplace",
}: Props) {
  const { rive, RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    autoplay: true,
  });

  const phase = useStateMachineInput(rive, stateMachine, "phase");

  useEffect(() => {
    if (!phase) return;
    const map: Record<MarketplaceMatchState, number> = {
      idle: 0,
      hover: 1,
      request: 2,
      searching: 3,
      matching: 4,
      matched: 5,
      success: 6,
    };
    phase.value = map[state] ?? 0;
  }, [phase, state]);

  return <RiveComponent className={className} />;
}
