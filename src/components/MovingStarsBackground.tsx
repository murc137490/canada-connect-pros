import * as React from "react";
import {
  type HTMLMotionProps,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/utils";

type StarLayerProps = HTMLMotionProps<"div"> & {
  count: number;
  size: number;
  transition: { repeat?: number; duration?: number; ease?: string };
  starColor: string;
};

function generateStars(count: number, starColor: string) {
  const shadows: string[] = [];
  const range = 5000;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * range * 2) - range;
    const y = Math.floor(Math.random() * range * 2) - range;
    shadows.push(`${x}px ${y}px ${starColor}`);
  }
  return shadows.join(", ");
}

function StarLayer({
  count = 1000,
  size = 1,
  transition = { repeat: Infinity, duration: 50, ease: "linear" },
  starColor = "#fff",
  className,
  ...props
}: StarLayerProps) {
  const [boxShadow, setBoxShadow] = React.useState<string>("");

  React.useEffect(() => {
    setBoxShadow(generateStars(count, starColor));
  }, [count, starColor]);

  const layerHeight = 4000;
  return (
    <motion.div
      data-slot="star-layer"
      animate={{ y: [0, -layerHeight] }}
      transition={transition}
      className={cn("absolute top-0 left-0 w-full", className)}
      style={{ height: `${layerHeight}px` }}
      {...props}
    >
      <div
        className="absolute bg-transparent rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          boxShadow: boxShadow,
        }}
      />
      <div
        className="absolute bg-transparent rounded-full"
        style={{
          top: `${layerHeight}px`,
          width: `${size}px`,
          height: `${size}px`,
          boxShadow: boxShadow,
        }}
      />
    </motion.div>
  );
}

type SpringOptions = { stiffness?: number; damping?: number };

type MovingStarsBackgroundProps = React.ComponentProps<"div"> & {
  factor?: number;
  speed?: number;
  transition?: SpringOptions;
  starColor?: string;
  pointerEvents?: boolean;
};

export default function MovingStarsBackground({
  children,
  className,
  factor = 0.05,
  speed = 50,
  transition = { stiffness: 50, damping: 20 },
  starColor = "#fff",
  pointerEvents = false,
  ...props
}: MovingStarsBackgroundProps) {
  const offsetX = useMotionValue(1);
  const offsetY = useMotionValue(1);

  const springX = useSpring(offsetX, transition);
  const springY = useSpring(offsetY, transition);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const newOffsetX = -(e.clientX - centerX) * factor;
      const newOffsetY = -(e.clientY - centerY) * factor;
      offsetX.set(newOffsetX);
      offsetY.set(newOffsetY);
    },
    [offsetX, offsetY, factor]
  );

  return (
    <div
      data-slot="stars-background"
      className={cn(
        "relative size-full min-h-full bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]",
        className
      )}
      onMouseMove={handleMouseMove}
      {...props}
    >
      {/* Stars in a full-size layer so they cover the whole area; overflow-hidden only here so content is not clipped */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          style={{ x: springX, y: springY }}
          className="absolute inset-0 w-full min-h-full"
        >
          <StarLayer
            count={1000}
            size={1}
            transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
            starColor={starColor}
          />
          <StarLayer
            count={400}
            size={2}
            transition={{
              repeat: Infinity,
              duration: speed * 2,
              ease: "linear",
            }}
            starColor={starColor}
          />
          <StarLayer
            count={200}
            size={3}
            transition={{
              repeat: Infinity,
              duration: speed * 3,
              ease: "linear",
            }}
            starColor={starColor}
          />
        </motion.div>
      </div>
      {children}
    </div>
  );
}
