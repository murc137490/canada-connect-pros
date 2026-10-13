import { useEffect } from "react";
import { useRive } from "@rive-app/react-canvas";

const ARTBOARDS = ["Search", "Compare", "Booking", "Messages"] as const;
const STATE_MACHINES = ["Search playback", "Compare playback", "Booking playback", "Messages playback"] as const;

export default function RiveGuideScene({ scene, active }: { scene: number; active: boolean }) {
  const artboard = ARTBOARDS[scene] ?? ARTBOARDS[0];
  const stateMachine = STATE_MACHINES[scene] ?? STATE_MACHINES[0];
  const { rive, RiveComponent } = useRive({
    src: "/rive/altshift-guide.riv",
    artboard,
    stateMachines: stateMachine,
    autoplay: false,
  });

  useEffect(() => {
    if (!rive) return;
    if (active) rive.play(stateMachine);
    else rive.pause(stateMachine);
  }, [active, rive, stateMachine]);

  return (
    <div className="flex h-16 w-[5.5rem] shrink-0 items-center justify-center" aria-hidden="true">
      <RiveComponent className="h-full w-full" />
    </div>
  );
}
