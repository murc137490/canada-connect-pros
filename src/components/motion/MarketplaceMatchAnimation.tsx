import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { MarketplaceMatchState } from "@/motion/types";
import { MOTION } from "@/motion/types";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  state: MarketplaceMatchState;
  requestLabel?: string;
  className?: string;
  dark?: boolean;
};

const PROS = [
  { id: "a", x: 292, y: 58 },
  { id: "b", x: 312, y: 128 },
  { id: "c", x: 286, y: 198 },
];

export default function MarketplaceMatchAnimation({
  state,
  requestLabel,
  className,
  dark = false,
}: Props) {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const label = requestLabel || t.index.mockRequestTitle;

  const showRequest = state !== "idle";
  const showPaths =
    state === "searching" || state === "matching" || state === "matched" || state === "success";
  const showPros = state === "matching" || state === "matched" || state === "success";
  const highlight = state === "matched" || state === "success";
  const searching = state === "searching";

  const ink = dark ? "rgba(255,255,255,0.88)" : "hsl(222 68% 20%)";
  const mute = dark ? "rgba(255,255,255,0.28)" : "hsl(222 20% 70%)";
  const accent = dark ? "hsl(24 90% 58%)" : "hsl(24 90% 48%)";
  const soft = dark ? "rgba(255,255,255,0.06)" : "hsl(36 22% 96%)";

  return (
    <div
      className={cn("relative w-full aspect-[4/3] max-w-[420px] mx-auto select-none", className)}
      aria-hidden
    >
      <svg viewBox="0 0 380 260" className="h-full w-full overflow-visible" role="img">
        <title>{t.index.motionMarketplaceTitle}</title>

        {/* Soft plane */}
        <rect x="8" y="8" width="364" height="244" rx="12" fill={soft} opacity={dark ? 0.35 : 1} />

        {/* Paths: request → hub → pros */}
        <AnimatePresence>
          {showPaths && (
            <>
              <motion.path
                key="to-hub"
                d="M 92 130 C 130 130, 150 130, 190 130"
                fill="none"
                stroke={ink}
                strokeWidth="1.5"
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.45, ease: MOTION.ease }}
              />
              {PROS.map((pro, i) => (
                <motion.path
                  key={`to-${pro.id}`}
                  d={`M 190 130 C 230 ${130 + (i - 1) * 8}, 250 ${pro.y}, ${pro.x - 28} ${pro.y}`}
                  fill="none"
                  stroke={highlight && i === 0 ? accent : mute}
                  strokeWidth={highlight && i === 0 ? 2 : 1.25}
                  strokeLinecap="round"
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: highlight ? (i === 0 ? 0.95 : 0.22) : searching ? 0.45 : 0.7,
                  }}
                  transition={{
                    duration: reduced ? 0 : 0.5,
                    delay: reduced ? 0 : 0.18 + i * 0.1,
                    ease: MOTION.ease,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Request node */}
        <AnimatePresence>
          {showRequest && (
            <motion.g
              key="request"
              initial={reduced ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
            >
              <rect x="28" y="104" width="78" height="52" rx="8" fill={dark ? "rgba(255,255,255,0.08)" : "#fff"} stroke={ink} strokeOpacity="0.18" />
              <text x="67" y="124" textAnchor="middle" fill={mute} fontSize="8" fontWeight="700" letterSpacing="0.12em">
                {t.index.mockRequestLabel.toUpperCase()}
              </text>
              <text x="67" y="142" textAnchor="middle" fill={ink} fontSize="11" fontWeight="700">
                {label.length > 14 ? `${label.slice(0, 13)}…` : label}
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Hub — Première */}
        <motion.g
          animate={
            reduced
              ? { scale: 1 }
              : searching
                ? { scale: [1, 1.04, 1] }
                : state === "idle" || state === "hover"
                  ? { scale: [1, 1.02, 1] }
                  : highlight
                    ? { scale: 1.03 }
                    : { scale: 1 }
          }
          transition={
            searching || state === "idle" || state === "hover"
              ? { duration: state === "idle" ? 3.2 : 1.4, repeat: Infinity, ease: "easeInOut" }
              : { duration: MOTION.base }
          }
          style={{ transformOrigin: "190px 130px" }}
        >
          <circle cx="190" cy="130" r="28" fill={dark ? "rgba(255,255,255,0.1)" : "#fff"} stroke={ink} strokeOpacity="0.2" />
          <circle
            cx="190"
            cy="130"
            r="28"
            fill="none"
            stroke={accent}
            strokeOpacity={searching ? 0.55 : 0}
            strokeWidth="1.5"
          />
          <text x="190" y="126" textAnchor="middle" fill={ink} fontSize="15" fontWeight="800" fontFamily="Manrope, system-ui, sans-serif">
            P
          </text>
          <text x="190" y="142" textAnchor="middle" fill={mute} fontSize="7" fontWeight="600" letterSpacing="0.08em">
            PREMIÈRE
          </text>
        </motion.g>

        {/* Travelling pulse while searching */}
        {searching && !reduced && (
          <circle r="3.5" fill={accent}>
            <animateMotion dur="1.1s" repeatCount="indefinite" path="M 92 130 C 130 130, 150 130, 190 130" />
          </circle>
        )}

        {/* Pro nodes */}
        <AnimatePresence>
          {showPros &&
            PROS.map((pro, i) => {
              const active = highlight && i === 0;
              const dim = highlight && i !== 0;
              return (
                <motion.g
                  key={pro.id}
                  initial={reduced ? false : { opacity: 0, scale: 0.86 }}
                  animate={{ opacity: dim ? 0.35 : 1, scale: active ? 1.05 : 1 }}
                  transition={{
                    duration: MOTION.base,
                    delay: reduced ? 0 : i * 0.12,
                    ease: MOTION.ease,
                  }}
                  style={{ transformOrigin: `${pro.x}px ${pro.y}px` }}
                >
                  <rect
                    x={pro.x - 26}
                    y={pro.y - 18}
                    width="56"
                    height="36"
                    rx="8"
                    fill={dark ? "rgba(255,255,255,0.08)" : "#fff"}
                    stroke={active ? accent : ink}
                    strokeOpacity={active ? 0.7 : 0.14}
                    strokeWidth={active ? 1.75 : 1}
                  />
                  <text x={pro.x} y={pro.y - 2} textAnchor="middle" fill={accent} fontSize="9" fontWeight="700">
                    ★ {i === 0 ? "4.9" : i === 1 ? "4.8" : "4.7"}
                  </text>
                  <text x={pro.x} y={pro.y + 12} textAnchor="middle" fill={ink} fontSize="9" fontWeight="700">
                    {i === 0 ? "ABC" : i === 1 ? "XYZ" : "F&F"}
                  </text>
                </motion.g>
              );
            })}
        </AnimatePresence>

        {/* Status caption */}
        <AnimatePresence mode="wait">
          {(state === "searching" || state === "matching" || state === "matched" || state === "success") && (
            <motion.text
              key={state}
              x="190"
              y="248"
              textAnchor="middle"
              fill={mute}
              fontSize="10"
              fontWeight="600"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.fast }}
            >
              {state === "searching" && t.index.motionSearching}
              {state === "matching" && t.index.motionMatching}
              {(state === "matched" || state === "success") && t.index.mockProsAvailable}
            </motion.text>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
