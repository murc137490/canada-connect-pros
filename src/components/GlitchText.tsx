import { useState, useEffect, useRef } from "react";

const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;':\"<>?,./~`";
const UNICODE_GLITCH = "▓▒░█▄▀■□▪▫◘◙☼♠♣♥♦";

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function glitchString(
  originalText: string,
  time: number,
  glitchSpeed: number,
  corruptionLevel: number
): string {
  let result = "";
  const seedBase = Math.floor(time * glitchSpeed * 10);
  for (let i = 0; i < originalText.length; i++) {
    const char = originalText.charAt(i);
    const r = seededRandom(seedBase + i * 0.1 + (time * 100) % 1);
    if (char === " ") {
      result += " ";
    } else if (r < corruptionLevel) {
      const corruptionType = Math.floor(seededRandom(seedBase + i * 0.2 + 1) * 4);
      switch (corruptionType) {
        case 0:
          result += GLITCH_CHARS.charAt(Math.floor(seededRandom(seedBase + i * 0.3 + 2) * GLITCH_CHARS.length));
          break;
        case 1:
          result += UNICODE_GLITCH.charAt(Math.floor(seededRandom(seedBase + i * 0.3 + 3) * UNICODE_GLITCH.length));
          break;
        case 2:
          result += char + char;
          break;
        case 3:
          result += r > 0.5 ? char.toUpperCase() : char.toLowerCase();
          break;
        default:
          result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

interface GlitchTextProps {
  children: string;
  /** Glitch for this many seconds, then show clean text. Default 1.5 */
  duration?: number;
  speed?: number;
  corruption?: number;
  className?: string;
  as?: "span" | "p" | "h1" | "h2";
}

export default function GlitchText({
  children,
  duration = 1.5,
  speed = 4,
  corruption = 15,
  className = "",
  as: Tag = "span",
}: GlitchTextProps) {
  const [display, setDisplay] = useState(children);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>();
  const startRef = useRef(performance.now() / 1000);

  useEffect(() => {
    if (done) {
      setDisplay(children);
      return;
    }
    const corruptionLevel = Math.min(100, Math.max(0, corruption)) / 100;
    const tick = () => {
      const t = performance.now() / 1000 - startRef.current;
      if (t >= duration) {
        setDisplay(children);
        setDone(true);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      setDisplay(glitchString(children, t, speed, corruptionLevel));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [children, speed, corruption, duration, done]);

  return <Tag className={className}>{display}</Tag>;
}
