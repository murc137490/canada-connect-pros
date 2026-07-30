import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

type Slice = {
  key: string;
  label: string;
  value: number;
  color: string;
  href: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeDonutSlice(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const oStart = polarToCartesian(cx, cy, outerR, endAngle);
  const oEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const iStart = polarToCartesian(cx, cy, innerR, endAngle);
  const iEnd = polarToCartesian(cx, cy, innerR, startAngle);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

/** Premiere booking mix donut: sample share of popular job categories. */
export default function ServiceMixPie({ className }: { className?: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [played, setPlayed] = useState(false);

  const slices: Slice[] = useMemo(
    () => [
      {
        key: "home",
        label: t.index.pieSliceHome,
        value: 34,
        color: "hsl(222 76% 32%)",
        href: "/services/home-improvement",
      },
      {
        key: "clean",
        label: t.index.pieSliceCleaning,
        value: 26,
        color: "hsl(217 75% 48%)",
        href: "/services/cleaning",
      },
      {
        key: "outdoor",
        label: t.index.pieSliceOutdoor,
        value: 22,
        color: "hsl(35 92% 55%)",
        href: "/services/outdoor-seasonal",
      },
      {
        key: "other",
        label: t.index.pieSliceOther,
        value: 18,
        color: "hsl(210 20% 55%)",
        href: "/services",
      },
    ],
    [t]
  );

  const paths = useMemo(() => {
    let angle = 0;
    const gap = 2.2;
    return slices.map((slice) => {
      const sweep = (slice.value / 100) * 360 - gap;
      const start = angle + gap / 2;
      const end = start + Math.max(sweep, 0.5);
      angle += (slice.value / 100) * 360;
      return {
        ...slice,
        d: describeDonutSlice(100, 100, 52, 88, start, end),
      };
    });
  }, [slices]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const pieces = root.querySelectorAll<SVGPathElement>(".pie-slice");
      const floatEl = root.querySelector(".pie-float");

      gsap.set(pieces, { transformOrigin: "100px 100px", scale: 0.72, opacity: 0 });
      gsap.set(floatEl, { y: 10 });

      ScrollTrigger.create({
        trigger: root,
        start: "top 78%",
        once: true,
        onEnter: () => {
          setPlayed(true);
          gsap.to(pieces, {
            scale: 1,
            opacity: 1,
            duration: 0.85,
            stagger: 0.12,
            ease: "back.out(1.4)",
          });
          gsap.to(floatEl, {
            y: -8,
            duration: 2.8,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        },
      });
    }, root);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!played) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slices.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [played, slices.length]);

  const activeSlice = slices[active];

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative mx-auto flex w-full max-w-md flex-col items-center gap-6 sm:max-w-lg sm:flex-row sm:items-center sm:gap-8",
        className
      )}
    >
      <div className="pie-float relative w-[240px] shrink-0 sm:w-[280px]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,hsl(35_92%_60%/0.18),transparent_55%),radial-gradient(circle_at_70%_80%,hsl(217_75%_45%/0.16),transparent_50%)]" />
        <svg viewBox="0 0 200 200" className="relative z-10 h-auto w-full drop-shadow-lg" role="img" aria-label={t.index.pieTitle}>
          {paths.map((slice, i) => (
            <path
              key={slice.key}
              className="pie-slice cursor-pointer transition-[filter] duration-300"
              d={slice.d}
              fill={slice.color}
              style={{
                filter: i === active ? "brightness(1.08)" : "brightness(1)",
                opacity: played && i !== active ? 0.88 : undefined,
              }}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => navigate(slice.href)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(slice.href);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`${slice.label}, ${slice.value}%`}
            />
          ))}
          <circle cx="100" cy="100" r="44" className="fill-background" />
          <text
            x="100"
            y="94"
            textAnchor="middle"
            className="fill-muted-foreground text-[9px] font-semibold uppercase tracking-wider"
            style={{ fontSize: 9 }}
          >
            {t.index.pieCenterLabel}
          </text>
          <text
            x="100"
            y="114"
            textAnchor="middle"
            className="fill-foreground font-bold"
            style={{ fontSize: 22, fontWeight: 700 }}
          >
            {activeSlice.value}%
          </text>
        </svg>
      </div>

      <div className="w-full min-w-0 space-y-3 text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{t.index.pieEyebrow}</p>
          <h3 className="mt-1 font-heading text-xl font-bold text-foreground md:text-2xl">{t.index.pieTitle}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.index.pieSupport}</p>
        </div>
        <ul className="space-y-2">
          {slices.map((slice, i) => (
            <li key={slice.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => navigate(slice.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                  i === active
                    ? "border-secondary/40 bg-secondary/5 shadow-sm"
                    : "border-transparent bg-muted/25 hover:bg-muted/40"
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="flex-1 text-sm font-medium text-foreground">{slice.label}</span>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">{slice.value}%</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
