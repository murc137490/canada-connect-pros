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

type HighlightBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  /** CSS border-radius matching the target card */
  radius: string;
};

const TOUR_OUTLINE = "#4EA1FF";

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

function getHeaderBottom(): number {
  const header = document.querySelector<HTMLElement>("header.site-header");
  if (header) {
    const b = header.getBoundingClientRect().bottom;
    if (b > 0) return Math.ceil(b) + 4;
  }
  return 60;
}

function getSheetTop(isPhone: boolean): number {
  if (!isPhone) return window.innerHeight - 8;
  const sheet = document.querySelector<HTMLElement>("[data-tour-sheet]");
  if (sheet) {
    const t = sheet.getBoundingClientRect().top;
    if (t > 40 && t < window.innerHeight) return t;
  }
  return Math.round(window.innerHeight * 0.58);
}

/** Match card corners; bump slightly so the ring feels softer than a hard square. */
function readFriendlyRadius(el: Element): string {
  const raw = getComputedStyle(el as HTMLElement).borderRadius || "";
  const first = raw.split(/\s+/)[0] ?? "";
  const px = parseFloat(first);
  if (Number.isFinite(px) && first.includes("px")) {
    return `${Math.max(px, 14)}px`;
  }
  if (first.includes("rem")) {
    const rem = parseFloat(first);
    if (Number.isFinite(rem)) return `${Math.max(rem, 0.875)}rem`;
  }
  return "0.875rem";
}

function scrollTargetIntoBand(el: Element, isPhone: boolean): number {
  const headerBottom = getHeaderBottom();
  const sheetTop = getSheetTop(isPhone);
  const bandTop = headerBottom + 10;
  const bandBottom = Math.max(bandTop + 100, sheetTop - 10);
  const bandMid = (bandTop + bandBottom) / 2;

  const r = el.getBoundingClientRect();
  const focusH = Math.min(Math.max(r.height, 40), bandBottom - bandTop);
  const elMid = r.top + focusH / 2;
  const delta = elMid - bandMid;

  if (Math.abs(delta) <= 6) return 0;

  window.scrollBy({ top: delta, left: 0, behavior: "smooth" });
  // Rough duration for native smooth scroll over this distance (no early cut-off / snap)
  return Math.min(900, Math.max(280, Math.abs(delta) * 0.85));
}

/** Resolve when window scroll has gone idle (or hard timeout). */
function waitForScrollIdle(maxMs: number): Promise<void> {
  return new Promise((resolve) => {
    let lastY = window.scrollY;
    let stableTicks = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearInterval(poll);
      window.clearTimeout(hardStop);
      window.removeEventListener("scroll", onScroll);
      resolve();
    };

    const onScroll = () => {
      lastY = window.scrollY;
      stableTicks = 0;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    const poll = window.setInterval(() => {
      if (Math.abs(window.scrollY - lastY) < 0.5) {
        stableTicks += 1;
        // ~100–120ms of stillness = scroll finished
        if (stableTicks >= 3) finish();
      } else {
        lastY = window.scrollY;
        stableTicks = 0;
      }
    }, 40);
    const hardStop = window.setTimeout(finish, Math.max(120, maxMs));
  });
}

function measureHighlight(el: Element, isPhone: boolean): HighlightBox {
  const pad = isPhone ? 6 : 8;
  const r = el.getBoundingClientRect();
  const headerBottom = getHeaderBottom();
  const sheetTop = getSheetTop(isPhone);
  const maxBottom = Math.max(headerBottom + 64, sheetTop - 8);
  const radius = readFriendlyRadius(el);

  let top = r.top - pad;
  let left = r.left - pad;
  let width = r.width + pad * 2;
  let height = r.height + pad * 2;

  if (top < headerBottom) {
    height -= headerBottom - top;
    top = headerBottom;
  }
  if (top + height > maxBottom) {
    height = maxBottom - top;
  }

  if (height < 48) {
    top = Math.min(Math.max(r.top - pad, headerBottom + 4), maxBottom - 48);
    height = Math.min(Math.max(r.height + pad * 2, 48), maxBottom - top);
  }
  if (width < 48) {
    left = Math.max(6, r.left - pad);
    width = Math.max(48, Math.min(r.width + pad * 2, window.innerWidth - left - 6));
  }

  left = Math.max(6, Math.min(left, window.innerWidth - width - 6));
  width = Math.min(width, window.innerWidth - left - 6);

  return {
    top: Math.max(0, top),
    left,
    width: Math.max(40, width),
    height: Math.max(40, height),
    radius,
  };
}

/** Four dim panels leave a bright hole — content inside the outline stays clear. */
function SpotlightCutout({
  rect,
  onDismiss,
}: {
  rect: HighlightBox;
  onDismiss: () => void;
}) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const dim = "bg-black/55";

  return (
    <div className="absolute inset-0 z-[1]" aria-hidden>
      <div className={cn("absolute left-0 right-0 top-0", dim)} style={{ height: Math.max(0, rect.top) }} onClick={onDismiss} />
      <div
        className={cn("absolute bottom-0 left-0 right-0", dim)}
        style={{ top: rect.top + rect.height }}
        onClick={onDismiss}
      />
      <div
        className={cn("absolute", dim)}
        style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
        onClick={onDismiss}
      />
      <div
        className={cn("absolute", dim)}
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          width: Math.max(0, vw - (rect.left + rect.width)),
          height: rect.height,
        }}
        onClick={onDismiss}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
          border: `2.5px solid ${TOUR_OUTLINE}`,
          boxShadow: `0 0 0 1px rgba(78,161,255,0.35), 0 0 16px rgba(78,161,255,0.4)`,
        }}
      />
    </div>
  );
}

export function DashboardTour({ userId, segment, open, onClose, onFinished }: Props) {
  const { locale } = useLanguage();
  const steps = TOUR_STEPS[segment];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<HighlightBox | null>(null);
  const [spotlightReady, setSpotlightReady] = useState(false);
  const isPhone = useIsPhone();
  const lockY = useRef(0);
  const locked = useRef(false);

  const step = steps[index];
  const fr = locale === "fr";

  const applyScrollLock = useCallback((y: number) => {
    locked.current = true;
    lockY.current = y;
    const { documentElement: html, body } = document;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
  }, []);

  const clearScrollLock = useCallback(() => {
    if (!locked.current) return;
    locked.current = false;
    const { documentElement: html, body } = document;
    html.style.overflow = "";
    body.style.overflow = "";
    body.style.touchAction = "";
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, segment]);

  // Smooth scroll; bring outline in ~0.5s before settle, then lock when idle
  useLayoutEffect(() => {
    if (!open || !step) {
      setRect(null);
      setSpotlightReady(false);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let earlyTimer = 0;
    let followRaf = 0;

    setSpotlightReady(false);

    const measureNow = () => {
      const target = document.querySelector(step.target);
      if (!target || cancelled) return;
      setRect(measureHighlight(target, isPhone));
    };

    const startFollowing = () => {
      if (cancelled) return;
      measureNow();
      setSpotlightReady(true);
      const tick = () => {
        if (cancelled) return;
        measureNow();
        followRaf = requestAnimationFrame(tick);
      };
      followRaf = requestAnimationFrame(tick);
    };

    const stopFollowingAndLock = () => {
      cancelAnimationFrame(followRaf);
      followRaf = 0;
      if (cancelled) return;
      measureNow();
      applyScrollLock(window.scrollY);
    };

    raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      clearScrollLock();
      const expectedMs = scrollTargetIntoBand(el, isPhone);
      // Show outline ~half a second before the scroll would finish
      const earlyMs =
        expectedMs <= 0 ? 40 : Math.max(60, expectedMs - 500);

      earlyTimer = window.setTimeout(() => {
        if (cancelled) return;
        startFollowing();
      }, earlyMs);

      void waitForScrollIdle(expectedMs > 0 ? expectedMs + 120 : 100).then(() => {
        if (cancelled) return;
        stopFollowingAndLock();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(followRaf);
      window.clearTimeout(earlyTimer);
    };
  }, [open, index, step, isPhone, clearScrollLock, applyScrollLock]);

  useEffect(() => {
    if (!open) {
      clearScrollLock();
      return;
    }

    const blockScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-tour-sheet]")) return;
      e.preventDefault();
    };

    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });

    return () => {
      window.removeEventListener("wheel", blockScroll);
      window.removeEventListener("touchmove", blockScroll);
      clearScrollLock();
    };
  }, [open, clearScrollLock]);

  useEffect(() => {
    if (!open || !step || !spotlightReady) return;
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
  }, [open, step, isPhone, spotlightReady]);

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
        key={`tour-${segment}`}
        className="fixed inset-0 z-[90]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {!rect || !spotlightReady ? (
          <div className="absolute inset-0 z-[1] bg-black/40" onClick={onClose} aria-hidden />
        ) : (
          <motion.div
            className="absolute inset-0 z-[1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: MOTION.ease }}
          >
            <SpotlightCutout rect={rect} onDismiss={onClose} />
          </motion.div>
        )}

        {isPhone ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            data-tour-sheet
            className="absolute inset-x-0 bottom-0 z-[91] flex max-h-[min(42vh,18rem)] flex-col rounded-t-2xl border border-border bg-card text-card-foreground shadow-2xl"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: MOTION.ease }}
            onClick={(e) => e.stopPropagation()}
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: MOTION.ease }}
            onClick={(e) => e.stopPropagation()}
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
