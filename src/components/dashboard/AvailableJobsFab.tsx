import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOTION } from "@/motion/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ariaLabel: string;
  /** Shown on the FAB when there are jobs */
  badgeCount?: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * Phone-only top-right FAB (exclamation), patterned after the support Help FAB.
 * Opens a sheet with Available jobs near you.
 */
export function AvailableJobsFab({
  open,
  onOpenChange,
  title,
  ariaLabel,
  badgeCount = 0,
  children,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const fabPos =
    "fixed z-[55] top-[calc(4.5rem+env(safe-area-inset-top,0px))] right-[max(1rem,env(safe-area-inset-right))]";
  const panelPos =
    "fixed z-[55] top-[calc(4.35rem+env(safe-area-inset-top,0px))] right-[max(0.75rem,env(safe-area-inset-right))]";

  return createPortal(
    <div className={cn("lg:hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!open ? (
          <motion.button
            key="jobs-fab"
            type="button"
            data-tour="available-jobs"
            onClick={() => onOpenChange(true)}
            aria-label={ariaLabel}
            aria-expanded={false}
            className={cn(
              fabPos,
              "relative flex h-12 w-12 items-center justify-center rounded-full",
              "bg-primary text-primary-foreground shadow-lg shadow-black/25",
              "border border-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            initial={{ opacity: 0, scale: 0.8, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -6 }}
            transition={{ duration: 0.22, ease: MOTION.ease }}
            whileTap={{ scale: 0.94 }}
          >
            <span className="text-xl font-black leading-none" aria-hidden>
              !
            </span>
            {badgeCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            ) : null}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="jobs-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            data-tour="available-jobs"
            className={cn(
              panelPos,
              "flex max-h-[min(70vh,28rem)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl origin-top-right",
            )}
            initial={{ opacity: 0, scale: 0.92, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: 0.24, ease: MOTION.ease }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
              <h3 className="font-heading text-sm font-bold text-foreground">{title}</h3>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
