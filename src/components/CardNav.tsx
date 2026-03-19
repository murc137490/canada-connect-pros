import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { LiquidButton } from "@/components/ui/liquid-button";
import "./CardNav.css";

export interface CardNavLink {
  label: string;
  href?: string;
  ariaLabel?: string;
}

export interface CardNavItem {
  label: string;
  bgColor: string;
  textColor: string;
  description?: string;
  links?: CardNavLink[];
}

interface CardNavProps {
  logoText?: string;
  items: CardNavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function CardNav({
  logoText = "Premiere Services",
  items,
  className = "",
  ease = "power3.out",
  baseColor,
  menuColor,
  buttonBgColor,
  buttonTextColor,
  ctaLabel = "Get Started",
  ctaHref = "/join-pros/plans",
}: CardNavProps) {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    if (isMobile) {
      const contentEl = navEl.querySelector(".card-nav-content") as HTMLElement;
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";

        contentEl.offsetHeight;

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardsRef.current.filter(Boolean), { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight(),
      duration: 0.4,
      ease: ease as gsap.EaseString,
    });

    tl.to(
      cardsRef.current.filter(Boolean),
      { y: 0, opacity: 1, duration: 0.4, ease: ease as gsap.EaseString, stagger: 0.08 },
      "-=0.1"
    );

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [ease, items.length]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current || !navRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el;
  };

  const displayItems = (items || []).slice(0, 4);

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? "open" : ""}`}
        style={{
          backgroundColor: baseColor ?? "var(--card, #fff)",
        }}
      >
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? "open" : ""}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleMenu()}
            style={{ color: menuColor ?? "hsl(var(--foreground))" }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <div className="card-nav-logo">{logoText}</div>

          <LiquidButton
            asChild
            whiteUntilHover
            className="card-nav-cta-button"
            style={{
              ["--liquid-button-background-color" as string]: buttonBgColor ?? "hsl(var(--primary))",
              ["--liquid-button-color" as string]: buttonTextColor ?? "hsl(var(--primary-foreground))",
            }}
          >
            <Link
              to={ctaHref}
              style={{
                color: "#1f2937",
              }}
            >
              {ctaLabel}
            </Link>
          </LiquidButton>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {displayItems.map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              {item.description ? (
                <div className="nav-card-desc">{item.description}</div>
              ) : (
                item.links && item.links.length > 0 && (
                  <div className="nav-card-links">
                    {item.links.map((lnk, i) => (
                      <a
                        key={`${lnk.label}-${i}`}
                        className="nav-card-link"
                        href={lnk.href ?? "#"}
                        aria-label={lnk.ariaLabel ?? lnk.label}
                      >
                        {lnk.label}
                      </a>
                    ))}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
