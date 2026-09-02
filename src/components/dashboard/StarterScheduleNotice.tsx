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
              className="pointer-events-none absolute text-[1.15rem] font-black leading-none text-white"
              style={{
                // ~70% inside; peek top-right, slightly tilted
                top: "42%",
                left: "52%",
                transform: "translate(-35%, -62%) rotate(16deg)",
                textShadow: "0 1px 1px rgba(0,0,0,0.25)",
              }}
            >
              !
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
