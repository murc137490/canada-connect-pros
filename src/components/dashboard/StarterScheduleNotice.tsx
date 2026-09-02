import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
  upgradeLabel: string;
  className?: string;
  ariaLabel?: string;
};

/** Custom ! — fat top tapering down to a thinner base, then a separate dot. */
function ExclamationMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 34" className={cn("overflow-visible", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M5.2 1.2C5.2 1.2 7.4 0.2 12 0.2s6.8 1 6.8 1L14.2 18.6c-0.35 1.15-1.15 1.7-2.2 1.7s-1.85-0.55-2.2-1.7L5.2 1.2Z"
      />
      <circle cx="12" cy="28.2" r="4.1" fill="currentColor" />
    </svg>
  );
}

/** Small bouncing red badge — white tilted ! mostly inside the circle (~70%). */
export function StarterScheduleNotice({ message, upgradeLabel, className, ariaLabel }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
            className,
          )}
          aria-label={ariaLabel ?? "Starter plan schedule info"}
        >
          <motion.span
            className="relative flex h-6 w-6 items-center justify-center overflow-visible rounded-full bg-red-500 shadow-sm"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <span
              className="pointer-events-none absolute flex h-[1.35rem] w-[0.95rem] items-center justify-center text-white"
              style={{
                // ~70% inside; lean left → bottom-right; slight peek top-left
                top: "46%",
                left: "48%",
                transform: "translate(-55%, -58%) rotate(-18deg)",
              }}
            >
              <ExclamationMark className="h-full w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]" />
            </span>
          </motion.span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,18rem)] space-y-2 p-3 text-sm" sideOffset={8}>
        <p className="leading-relaxed text-muted-foreground">{message}</p>
        <Link
          to="/pro-plans"
          className="inline-flex text-sm font-semibold text-primary underline underline-offset-2 hover:opacity-90"
        >
          {upgradeLabel}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
