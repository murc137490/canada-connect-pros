import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import "./MagicBento.css";

export interface MagicBentoCard {
  id: string;
  title: string;
  description: string;
  label: string;
  href?: string;
  color?: string;
}

interface MagicBentoProps {
  cards: MagicBentoCard[];
  glowColor?: string;
  enableBorderGlow?: boolean;
}

function updateCardGlow(
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  intensity: number,
  radius: number
) {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;
  card.style.setProperty("--glow-x", `${relativeX}%`);
  card.style.setProperty("--glow-y", `${relativeY}%`);
  card.style.setProperty("--glow-intensity", String(intensity));
  card.style.setProperty("--glow-radius", `${radius}px`);
}

export default function MagicBento({
  cards,
  glowColor = "0, 122, 86",
  enableBorderGlow = true,
}: MagicBentoProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enableBorderGlow || !gridRef.current) return;
    const grid = gridRef.current;
    const cardEls = grid.querySelectorAll<HTMLElement>(".magic-bento-card");
    cardEls.forEach((card) => {
      card.style.setProperty("--glow-rgb", glowColor);
    });
    const handleMove = (e: MouseEvent) => {
      cardEls.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const inCard =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (inCard) {
          const dx = e.clientX - (rect.left + rect.width / 2);
          const dy = e.clientY - (rect.top + rect.height / 2);
          const dist = Math.hypot(dx, dy);
          const radius = 250;
          const intensity = dist < radius * 0.5 ? 1 : dist < radius * 0.75 ? 1 - (dist - radius * 0.5) / (radius * 0.25) : 0;
          updateCardGlow(card, e.clientX, e.clientY, intensity, radius);
        } else {
          card.style.setProperty("--glow-intensity", "0");
        }
      });
    };
    const handleLeave = () => {
      cardEls.forEach((card) => card.style.setProperty("--glow-intensity", "0"));
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [cards.length, enableBorderGlow, glowColor]);

  return (
    <div className="bento-section">
      <div className="magic-bento-grid" ref={gridRef}>
        {cards.map((card) => {
          const className = `magic-bento-card ${enableBorderGlow ? "magic-bento-card--border-glow" : ""}`;
          const style = { backgroundColor: card.color || "#060010" };
          const content = (
            <>
              <div className="magic-bento-card__header">
                <div className="magic-bento-card__label">{card.label}</div>
              </div>
              <div className="magic-bento-card__content">
                <h2 className="magic-bento-card__title">{card.title}</h2>
                <p className="magic-bento-card__description">{card.description}</p>
              </div>
            </>
          );
          if (card.href) {
            return (
              <Link
                key={card.id}
                to={card.href}
                className={className}
                style={style}
              >
                {content}
              </Link>
            );
          }
          return (
            <div key={card.id} className={className} style={style}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
