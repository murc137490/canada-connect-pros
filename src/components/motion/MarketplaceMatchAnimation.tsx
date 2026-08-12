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
  { id: "a", x: 300, y: 62, rating: "4.9", name: "ABC" },
  { id: "b", x: 318, y: 130, rating: "4.8", name: "XYZ" },
  { id: "c", x: 294, y: 198, rating: "4.7", name: "F&F" },
];

function shortLabel(raw: string, max = 12) {
  const t = raw.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export default function MarketplaceMatchAnimation({
  state,
  requestLabel,
  className,
  dark = false,
}: Props) {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const label = shortLabel(requestLabel || t.index.demoServicePlumbing, 12);

  // hover = CTA hint only (hub pulse). Request card appears from "request" onward.
  const showRequest =
    state === "request" ||
    state === "searching" ||
    state === "matching" ||
    state === "matched" ||
    state === "success";
  const showPaths =
    state === "searching" || state === "matching" || state === "matched" || state === "success";
  const showPros = state === "matching" || state === "matched" || state === "success";
  const highlight = state === "matched" || state === "success";
  const searching = state === "searching";
  const idleLike = state === "idle" || state === "hover";

  const ink = dark ? "rgba(255,255,255,0.88)" : "hsl(222 68% 20%)";
  const mute = dark ? "rgba(255,255,255,0.35)" : "hsl(222 12% 48%)";
  const accent = dark ? "hsl(24 90% 58%)" : "hsl(24 90% 48%)";
  const soft = dark ? "rgba(255,255,255,0.06)" : "hsl(36 18% 95%)";
  const card = dark ? "rgba(255,255,255,0.09)" : "#fff";

  return (
    <div
      className={cn("relative w-full aspect-[4/3] max-w-[420px] mx-auto select-none", className)}
      aria-hidden
    >
      <svg viewBox="0 0 380 260" className="h-full w-full overflow-visible" role="img">
        <title>{t.index.motionMarketplaceTitle}</title>

        <rect x="8" y="8" width="364" height="244" rx="14" fill={soft} opacity={dark ? 0.4 : 1} />

        {/* Idle ghost: hints the flow without looking broken */}
        {idleLike && (
          <g opacity={state === "hover" ? 0.55 : 0.32}>
            <path
              d="M 100 130 C 130 130, 155 130, 190 130"
              fill="none"
              stroke={mute}
              strokeWidth="1.25"
              strokeDasharray="4 5"
            />
            {PROS.map((pro) => (
              <path
                key={`ghost-${pro.id}`}
                d={`M 190 130 C 230 ${pro.y}, 255 ${pro.y}, ${pro.x - 26} ${pro.y}`}
                fill="none"
                stroke={mute}
                strokeWidth="1"
                strokeDasharray="4 5"
              />
            ))}
            <rect x="24" y="108" width="86" height="44" rx="8" fill={card} stroke={ink} strokeOpacity="0.12" />
            <text x="67" y="126" textAnchor="middle" fill={mute} fontSize="7.5" fontWeight="700" letterSpacing="0.1em">
              {t.index.mockRequestLabel.toUpperCase()}
            </text>
            <text x="67" y="142" textAnchor="middle" fill={ink} fontSize="11" fontWeight="700">
              {t.index.demoServicePlumbing}
            </text>
            {PROS.map((pro) => (
              <circle key={`dot-${pro.id}`} cx={pro.x} cy={pro.y} r="7" fill={card} stroke={mute} strokeWidth="1" />
            ))}
          </g>
        )}

        <AnimatePresence>
          {showPaths && (
            <>
              <motion.path
                key="to-hub"
                d="M 100 130 C 130 130, 155 130, 190 130"
                fill="none"
                stroke={ink}
                strokeWidth="1.75"
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.45, ease: MOTION.ease }}
              />
              {PROS.map((pro, i) => (
                <motion.path
                  key={`to-${pro.id}`}
                  d={`M 190 130 C 230 ${pro.y}, 255 ${pro.y}, ${pro.x - 26} ${pro.y}`}
                  fill="none"
                  stroke={highlight && i === 0 ? accent : mute}
                  strokeWidth={highlight && i === 0 ? 2 : 1.25}
                  strokeLinecap="round"
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: 1,
                    opacity: highlight ? (i === 0 ? 0.95 : 0.2) : searching ? 0.4 : 0.65,
                  }}
                  transition={{
                    duration: reduced ? 0 : 0.5,
                    delay: reduced ? 0 : 0.15 + i * 0.1,
                    ease: MOTION.ease,
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showRequest && (
            <motion.g
              key="request"
              initial={reduced ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
            >
              <rect
                x="22"
                y="104"
                width="92"
                height="52"
                rx="9"
                fill={card}
                stroke={ink}
                strokeOpacity="0.16"
              />
              <text
                x="68"
                y="124"
                textAnchor="middle"
                fill={mute}
                fontSize="7.5"
                fontWeight="700"
                letterSpacing="0.1em"
              >
                {t.index.mockRequestLabel.toUpperCase()}
              </text>
              <text x="68" y="143" textAnchor="middle" fill={ink} fontSize="12" fontWeight="700">
                {label}
              </text>
            </motion.g>
          )}
        </AnimatePresence>

        <motion.g
          animate={
            reduced
              ? { scale: 1 }
              : searching
                ? { scale: [1, 1.05, 1] }
                : idleLike
                  ? { scale: [1, 1.025, 1] }
                  : highlight
                    ? { scale: 1.04 }
                    : { scale: 1 }
          }
          transition={
            searching || idleLike
              ? { duration: idleLike ? 3.4 : 1.35, repeat: Infinity, ease: "easeInOut" }
              : { duration: MOTION.base }
          }
          style={{ transformOrigin: "190px 130px" }}
        >
          <circle cx="190" cy="130" r="30" fill={card} stroke={ink} strokeOpacity="0.18" />
          <circle
            cx="190"
            cy="130"
            r="30"
            fill="none"
            stroke={accent}
            strokeOpacity={searching || state === "hover" ? 0.5 : 0}
            strokeWidth="1.5"
          />
          <text
            x="190"
            y="126"
            textAnchor="middle"
            fill={ink}
            fontSize="16"
            fontWeight="800"
            fontFamily="Manrope, system-ui, sans-serif"
          >
            P
          </text>
          <text
            x="190"
            y="143"
            textAnchor="middle"
            fill={mute}
            fontSize="7"
            fontWeight="700"
            letterSpacing="0.1em"
          >
            PREMIÈRE
          </text>
        </motion.g>

        {searching && !reduced && (
          <circle r="3.5" fill={accent}>
            <animateMotion
              dur="1.05s"
              repeatCount="indefinite"
              path="M 100 130 C 130 130, 155 130, 190 130"
            />
          </circle>
        )}

        <AnimatePresence>
          {showPros &&
            PROS.map((pro, i) => {
              const active = highlight && i === 0;
              const dim = highlight && i !== 0;
              return (
                <motion.g
                  key={pro.id}
                  initial={reduced ? false : { opacity: 0, scale: 0.88 }}
                  animate={{ opacity: dim ? 0.32 : 1, scale: active ? 1.06 : 1 }}
                  transition={{
                    duration: MOTION.base,
                    delay: reduced ? 0 : i * 0.11,
                    ease: MOTION.ease,
                  }}
                  style={{ transformOrigin: `${pro.x}px ${pro.y}px` }}
                >
                  <rect
                    x={pro.x - 28}
                    y={pro.y - 18}
                    width="58"
                    height="36"
                    rx="8"
                    fill={card}
                    stroke={active ? accent : ink}
                    strokeOpacity={active ? 0.75 : 0.14}
                    strokeWidth={active ? 1.75 : 1}
                  />
                  <text x={pro.x} y={pro.y - 2} textAnchor="middle" fill={accent} fontSize="9" fontWeight="700">
                    ★ {pro.rating}
                  </text>
                  <text x={pro.x} y={pro.y + 12} textAnchor="middle" fill={ink} fontSize="9" fontWeight="700">
                    {pro.name}
                  </text>
                </motion.g>
              );
            })}
        </AnimatePresence>

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
