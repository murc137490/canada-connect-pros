import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import "./PillNav.css";

export interface PillNavItem {
  label: string;
  href: string;
}

interface PillNavLinksProps {
  items: PillNavItem[];
  className?: string;
  ease?: string;
}

export default function PillNavLinks({ items, className = "", ease = "power3.easeOut" }: PillNavLinksProps) {
  const location = useLocation();
  const circleRefs = useRef<HTMLElement[]>([]);
  const tlRefs = useRef<gsap.core.Timeline[]>([]);
  const activeTweenRefs = useRef<gsap.core.Tween[]>([]);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;
        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const R = (w * w) / 4 + h * h;
        const Rdiv = 2 * h;
        const Rval = Rdiv ? R / Rdiv : h;
        const D = Math.ceil(2 * Rval) + 2;
        const delta = Math.ceil(Rval - Math.sqrt(Math.max(0, Rval * Rval - (w * w) / 4))) + 1;
        const originY = D - delta;

        (circle as HTMLElement).style.width = `${D}px`;
        (circle as HTMLElement).style.height = `${D}px`;
        (circle as HTMLElement).style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`,
        });

        const label = pill.querySelector(".pill-label");
        const white = pill.querySelector(".pill-label-hover");
        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 0.5, ease, overwrite: "auto" }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 0.5, ease, overwrite: "auto" }, 0);
        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 0.5, ease, overwrite: "auto" }, 0);
        }
        tlRefs.current[index] = tl;
      });
    };

    layout();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    if (document.fonts?.ready) document.fonts.ready.then(layout).catch(() => {});

    return () => window.removeEventListener("resize", onResize);
  }, [items, ease]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.25,
      ease,
      overwrite: "auto",
    }) as gsap.core.Tween;
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: "auto",
    }) as gsap.core.Tween;
  };

  return (
    <nav className={`pill-nav-links ${className}`} aria-label="Primary">
      <ul className="pill-nav-list" role="menubar">
        {items.map((item, i) => {
          const isActive =
            location.pathname === item.href ||
            (item.href === "/#how-it-works" && location.pathname === "/");
          return (
            <li key={item.href} role="none">
              <Link
                role="menuitem"
                to={item.href}
                className={`pill-nav-link${isActive ? " is-active" : ""}`}
                aria-label={item.label}
                onMouseEnter={() => handleEnter(i)}
                onMouseLeave={() => handleLeave(i)}
              >
                <span
                  className="pill-hover-circle"
                  aria-hidden="true"
                  ref={(el) => {
                    if (el) circleRefs.current[i] = el;
                  }}
                />
                <span className="pill-label-stack">
                  <span className="pill-label">{item.label}</span>
                  <span className="pill-label-hover" aria-hidden="true">
                    {item.label}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
