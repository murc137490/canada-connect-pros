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

/** Small bouncing red ! for Starter schedule window — opens tip on click. */
export function StarterScheduleNotice({ message, upgradeLabel, className, ariaLabel }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50",
            className,
          )}
          aria-label={ariaLabel ?? "Starter plan schedule info"}
        >
          <motion.span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black leading-none text-white shadow-sm"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            !
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
