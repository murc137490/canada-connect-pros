import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

import "./liquid.css";

export interface LiquidButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  asChild?: boolean;
  delay?: number;
  fillHeight?: number;
  hoverScale?: number;
  tapScale?: number;
  /** When true, button is white by default; gradient shows only when hover fill animation runs */
  whiteUntilHover?: boolean;
  children?: React.ReactNode;
}

const LiquidButtonPrimitive = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  (
    {
      className,
      asChild = false,
      delay = 0,
      fillHeight = 100,
      hoverScale = 1.05,
      tapScale = 0.95,
      whiteUntilHover = false,
      style,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : motion.button;
    const rootStyle = {
      "--liquid-fill-height": `${fillHeight}%`,
      "--liquid-fill-delay": `${delay}s`,
      "--liquid-hover-scale": String(hoverScale),
      "--liquid-tap-scale": String(tapScale),
    } as React.CSSProperties;
    const mergedRootStyle =
      typeof style === "object" && style !== null
        ? { ...rootStyle, ...style }
        : rootStyle;

    return (
      <span
        className={cn("liquid-button-root", whiteUntilHover && "liquid-button-root--white-until-hover")}
        style={mergedRootStyle}
      >
        <span className="liquid-button-shine" aria-hidden />
        <span className="liquid-button-fill" aria-hidden />
        <Comp
          ref={ref}
          className={cn("liquid-button-trigger", className)}
          {...(asChild ? {} : { whileHover: { scale: hoverScale }, whileTap: { scale: tapScale }, transition: { type: "spring" as const, stiffness: 400, damping: 17 } })}
          {...props}
        />
      </span>
    );
  }
);

LiquidButtonPrimitive.displayName = "LiquidButtonPrimitive";

export { LiquidButtonPrimitive };
