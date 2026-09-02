import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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

type HighlightBox = { top: number; left: number; width: number; height: number };

function useIsPhone() {
  const [phone, setPhone] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false,
  );
  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return phone;
}

/** Bottom of fixed site header (logo / lang / theme / account / menu) — never outline into this. */
function getHeaderBottom(): number {
  const header = document.querySelector<HTMLElement>("header.site-header");
  if (header) {
    const b = header.getBoundingClientRect().bottom;
    if (b > 0) return Math.ceil(b) + 6;
  }
  return Math.ceil(56 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue("env(safe-area-inset-top)") || "0", 10) || 0)) + 6;
}

function phoneSheetReserve(): number {
  return Math.min(300, Math.round(window.innerHeight * 0.44));
}

/** Place target in the band between header and (on phone) bottom sheet — once, no animation fight. */
function scrollTargetIntoBand(el: Element, isPhone: boolean) {
  const headerBottom = getHeaderBottom();
  const sheet = isPhone ? phoneSheetReserve() : 24;
  const bandTop = headerBottom + 10;
  const bandBottom = window.innerHeight - sheet - 10;
  const r = el.getBoundingClientRect();
  let delta = 0;
  if (r.top < bandTop) delta = r.top - bandTop;
  else if (r.bottom > bandBottom) delta = r.bottom - bandBottom;
  if (Math.abs(delta) > 2) {
    window.scrollBy({ top: delta, left: 0, behavior: "instant" as ScrollBehavior });
  }
}

function measureHighlight(el: Element, isPhone: boolean): HighlightBox | null {
  const pad = isPhone ? 3 : 6;
  const r = el.getBoundingClientRect();
  const headerBottom = getHeaderBottom();
  const sheetTop = isPhone ? window.innerHeight - phoneSheetReserve() : window.innerHeight - 8;

  // Exact target box, then clamp so it never covers the site header or the sheet.
  let top = r.top - pad;
  let left = r.left - pad;
  let right = r.right + pad;
  let bottom = r.bottom + pad;

  top = Math.max(headerBottom, top);
  left = Math.max(8, left);
  right = Math.min(window.innerWidth - 8, right);
  bottom = Math.min(sheetTop - 8, bottom);

  const width = right - left;
  const height = bottom - top;
  if (width < 12 || height < 12) return null;

  return { top, left, width, height };
}

export function DashboardTour({ userId, segment, open, onClose, onFinished }: Props) {
  const { locale } = useLanguage();
  const steps = TOUR_STEPS[segment];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<HighlightBox | null>(null);
  const isPhone = useIsPhone();
  const lockY = useRef(0);

  const step = steps[index];
  const fr = locale === "fr";

  // Reset step when segment / open changes
  useLayoutEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, segment]);

  // Position once per step, then freeze scroll until Skip / Next
  useLayoutEffect(() => {
    if (!open || !step) {
      setRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      setRect(null);
      return;
    }

    scrollTargetIntoBand(el, isPhone);
    // Second frame after layout settles
    const id = requestAnimationFrame(() => {
      setRect(measureHighlight(el, isPhone));
    });
    return () => cancelAnimationFrame(id);
  }, [open, index, step, isPhone]);

  // Lock page scroll while tour is open (Skip / Next / close unlocks)
  useEffect(() => {
    if (!open) return;

    lockY.current = window.scrollY;
    const { documentElement: html, body } = document;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyTouch = body.style.touchAction;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";

    const blockScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-tour-sheet]")) return;
      e.preventDefault();
    };

    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.touchAction = prevBodyTouch;
      window.removeEventListener("wheel", blockScroll);
      window.removeEventListener("touchmove", blockScroll);
      window.scrollTo(0, lockY.current);
    };
  }, [open]);

  // Remeasure only on orientation / resize — not on scroll (scroll is locked)
  useEffect(() => {
    if (!open || !step) return;
    const onResize = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      setRect(measureHighlight(el, isPhone));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [open, step, isPhone]);

  const finish = useCallback(() => {
    markSegmentCompleted(userId, segment);
    onFinished();
    onClose();
  }, [userId, segment, onFinished, onClose]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
  }, [index, steps.length, finish]);

  if (!open || !step) return null;

  const cardTopDesktop = rect
    ? Math.min(window.innerHeight - 220, rect.top + rect.height + 12)
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
        {/* Full dim — covers header so nav is not “in” the cutout */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

        {rect ? (
          <div
            className="pointer-events-none absolute rounded-lg ring-2 ring-primary bg-transparent"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            }}
          />
        ) : null}

        {isPhone ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            data-tour-sheet
            className="absolute inset-x-0 bottom-0 z-[91] flex max-h-[min(48vh,20rem)] flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-2">
              <div className="mb-2 flex shrink-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {index + 1} / {steps.length}
                  </p>
                  <h3 className="font-heading text-base font-bold leading-snug text-foreground">
                    {fr ? step.titleFr : step.titleEn}
                  </h3>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-relaxed text-muted-foreground overscroll-contain">
                {fr ? step.bodyFr : step.bodyEn}
              </p>
              <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border/60 pt-3">
                <Button type="button" variant="ghost" size="sm" className="min-h-10 px-3" onClick={onClose}>
                  {fr ? "Plus tard" : "Skip"}
                </Button>
                <Button type="button" size="sm" className="min-h-10 min-w-[6.5rem] px-4" onClick={next}>
                  {index >= steps.length - 1 ? (fr ? "Terminé" : "Done") : fr ? "Suivant" : "Next"}
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            role="dialog"
            aria-modal="true"
            data-tour-sheet
            className="absolute left-1/2 z-[91] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-xl"
            style={{ top: cardTopDesktop }}
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
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

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
        className,
      )}
      aria-label={label ?? (locale === "fr" ? "Relancer le guide" : "Replay guide")}
      title={label ?? (locale === "fr" ? "Relancer le guide de cette page" : "Replay this page’s guide")}
    >
      <HelpCircle size={12} />
      <span>{locale === "fr" ? "Aide" : "Help"}</span>
    </button>
  );
}
