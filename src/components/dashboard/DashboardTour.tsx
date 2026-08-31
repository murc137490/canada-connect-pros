import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOTION } from "@/motion/types";
import {
  type DashTourSegment,
  TOUR_STEPS,
  markSegmentCompleted,
} from "@/lib/dashboardTutorial";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  segment: DashTourSegment;
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
};

export function DashboardTour({ userId, segment, open, onClose, onFinished }: Props) {
  const { locale } = useLanguage();
  const steps = TOUR_STEPS[segment];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];
  const fr = locale === "fr";

  const measure = useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setRect(el.getBoundingClientRect());
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, segment]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const t = window.setTimeout(measure, 350);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.clearTimeout(t);
    };
  }, [open, index, measure]);

  if (!open || !step) return null;

  const finish = () => {
    markSegmentCompleted(userId, segment);
    onFinished();
    onClose();
  };

  const next = () => {
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  };

  const pad = 8;
  const highlight = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: Math.min(window.innerWidth - 16, rect.width + pad * 2),
        height: Math.min(window.innerHeight - 16, rect.height + pad * 2),
      }
    : null;

  const cardTop = highlight
    ? Math.min(window.innerHeight - 220, highlight.top + highlight.height + 12)
    : window.innerHeight / 2 - 100;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={`tour-${segment}-${index}`}
        className="fixed inset-0 z-[90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.fast }}
      >
        <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden />
        {highlight ? (
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] bg-transparent"
            style={{
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
            }}
          />
        ) : null}
        <motion.div
          role="dialog"
          aria-modal="true"
          className="absolute left-1/2 z-[91] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl"
          style={{ top: cardTop }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {index + 1} / {steps.length}
              </p>
              <h3 className="font-heading text-base font-bold text-foreground">
                {fr ? step.titleFr : step.titleEn}
              </h3>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{fr ? step.bodyFr : step.bodyEn}</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {fr ? "Plus tard" : "Skip"}
            </Button>
            <Button type="button" size="sm" onClick={next}>
              {index >= steps.length - 1 ? (fr ? "Terminé" : "Done") : fr ? "Suivant" : "Next"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/** Tiny ? control to replay a single segment. */
export function DashboardTourHelpButton({
  onClick,
  className,
  label,
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  const { locale } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-8 inline-flex items-center gap-1.5 self-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
        className
      )}
      aria-label={label ?? (locale === "fr" ? "Relancer le guide" : "Replay guide")}
      title={label ?? (locale === "fr" ? "Relancer le guide de cette page" : "Replay this page’s guide")}
    >
      <HelpCircle size={12} />
      <span>{locale === "fr" ? "Aide" : "Help"}</span>
    </button>
  );
}
