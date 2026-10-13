import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export default function HoldToConfirmButton({ children, onHold, className, duration = 1800 }: {
  children: React.ReactNode;
  onHold: () => void;
  className?: string;
  duration?: number;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const completed = useRef(false);
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    timer.current = null;
    setHolding(false);
    onHold();
  };
  const start = () => {
    if (timer.current !== null) return;
    completed.current = false;
    setHolding(true);
    timer.current = window.setTimeout(finish, duration);
  };
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    completed.current = false;
    setHolding(false);
  };
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => { if (event.button === 0) { event.currentTarget.setPointerCapture(event.pointerId); start(); } };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); start(); } };
  return (
    <button type="button" onPointerDown={onPointerDown} onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerLeave={cancel} onKeyDown={onKeyDown} onKeyUp={cancel}
      aria-label={typeof children === "string" ? `${children}. Press and hold for ${duration / 1000} seconds` : undefined}
      className={cn("hold-confirm relative isolate flex h-16 w-full items-center gap-3 overflow-hidden rounded-xl border border-destructive/30 bg-background p-4 text-left text-foreground", className)}>
      <span className="hold-confirm__progress" style={{ animationDuration: `${duration}ms`, animationName: holding ? "hold-confirm-fill" : "none" }} />
      <span className="relative z-10 flex items-center gap-3">{children}</span>
      <span className="sr-only">Press and hold to continue.</span>
    </button>
  );
}
