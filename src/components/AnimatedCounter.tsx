import { useSpring, useTransform, motion, type MotionValue } from "motion/react";
import { useEffect, type CSSProperties } from "react";
import "@/components/animated-counter.css";

function normalizeNearInteger(number: number) {
  const nearest = Math.round(number);
  return Math.abs(number - nearest) < 1e-9 * Math.max(1, Math.abs(number)) ? nearest : number;
}

function NumberColumn({ value, digit, height }: { value: MotionValue<number>; digit: number; height: number }) {
  const y = useTransform(value, (latest) => {
    const placeValue = ((latest % 10) + 10) % 10;
    const offset = (10 + digit - placeValue) % 10;
    let position = offset * height;
    if (offset > 5) position -= 10 * height;
    return position;
  });
  return <motion.span className="member-counter__number" style={{ y }}>{digit}</motion.span>;
}

function CounterDigit({ place, value, height }: { place: number; value: number; height: number }) {
  const rounded = Math.floor(normalizeNearInteger(value / place));
  const animated = useSpring(0, { stiffness: 120, damping: 22, mass: 0.7 });
  useEffect(() => animated.set(rounded), [animated, rounded]);

  return (
    <span className="member-counter__digit" style={{ height }} aria-hidden="true">
      {Array.from({ length: 10 }, (_, digit) => <NumberColumn key={digit} value={animated} digit={digit} height={height} />)}
    </span>
  );
}

export default function AnimatedCounter({ value, fontSize = 64, className, style }: {
  value: number;
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const safeValue = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const places = safeValue.toString().split("").map((_, index, digits) => 10 ** (digits.length - index - 1));
  const height = fontSize + 4;

  return (
    <span className={`member-counter ${className ?? ""}`} style={{ fontSize, height, ...style }} aria-label={safeValue.toLocaleString()}>
      {places.map((place) => <CounterDigit key={place} place={place} value={safeValue} height={height} />)}
    </span>
  );
}
