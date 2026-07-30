"use client";

import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "motion/react";
import { Children, cloneElement, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "./Dock.css";

const DOCK_WIDE_MQ = "(min-width: 768px)";
/** Viewports this small keep smaller slots so seven icons still fit in one row. */
const MOBILE_NARROW_MAX_W = 390;

type DockLayout = "wide" | "mobile" | "mobile-narrow";

function subscribeDockLayout(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(DOCK_WIDE_MQ);
  mq.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

function getDockLayoutSnapshot(): DockLayout {
  if (typeof window === "undefined") return "mobile";
  if (window.matchMedia(DOCK_WIDE_MQ).matches) return "wide";
  if (window.innerWidth <= MOBILE_NARROW_MAX_W) return "mobile-narrow";
  return "mobile";
}

function getDockLayoutServerSnapshot(): DockLayout {
  return "mobile";
}

function DockItem({
  children,
  className = "",
  onClick,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  spring: { mass: number; stiffness: number; damping: number };
  distance: number;
  magnification: number;
  baseItemSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = useMotionValue(0);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return val - rect.x - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size, minWidth: baseItemSize, minHeight: baseItemSize }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
      aria-haspopup="true"
    >
      {Children.map(children, (child) =>
        typeof child === "object" &&
        child !== null &&
        "type" in child &&
        (child as React.ReactElement).type === DockLabel
          ? cloneElement(child as React.ReactElement<{ isHovered?: ReturnType<typeof useMotionValue<number>> }>, {
              isHovered,
            })
          : child
      )}
    </motion.div>
  );
}

function DockLabel({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  isHovered?: ReturnType<typeof useMotionValue<number>>;
}) {
  const isHovered = (rest as { isHovered?: ReturnType<typeof useMotionValue<number>> }).isHovered;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isHovered) return;
    const unsubscribe = isHovered.on("change", (latest) => setIsVisible(latest === 1));
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
          className={`dock-label ${className}`}
          role="tooltip"
          style={{ left: "50%", x: "-50%" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DockIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`dock-icon ${className}`}>{children}</div>;
}

export interface DockItemConfig {
  /** Stable identity so inserting/removing items does not remount neighbors. */
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  /** Notification badge count; shown on the icon when > 0 */
  badge?: number;
}

export default function Dock({
  items,
  className = "",
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification: magnificationProp,
  distance: distanceProp,
  panelHeight: panelHeightProp,
  baseItemSize: baseItemSizeProp,
}: {
  items: DockItemConfig[];
  className?: string;
  spring?: { mass: number; stiffness: number; damping: number };
  magnification?: number;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
}) {
  const layout = useSyncExternalStore(subscribeDockLayout, getDockLayoutSnapshot, getDockLayoutServerSnapshot);
  const isWide = layout === "wide";

  const { baseItemSize, magnification, panelHeight, distance } = useMemo(() => {
    if (layout === "wide") {
      return {
        baseItemSize: baseItemSizeProp ?? 56,
        magnification: magnificationProp ?? 68,
        panelHeight: panelHeightProp ?? 80,
        distance: distanceProp ?? 200,
      };
    }
    if (layout === "mobile-narrow") {
      return {
        baseItemSize: baseItemSizeProp ?? 38,
        magnification: magnificationProp ?? 38,
        panelHeight: panelHeightProp ?? 74,
        distance: distanceProp ?? 92,
      };
    }
    /* Mobile (touch): larger icons + taller card; magnification === base (no hover grow) */
    return {
      baseItemSize: baseItemSizeProp ?? 42,
      magnification: magnificationProp ?? 42,
      panelHeight: panelHeightProp ?? 84,
      distance: distanceProp ?? 104,
    };
  }, [layout, baseItemSizeProp, magnificationProp, panelHeightProp, distanceProp]);

  const mouseX = useMotionValue(Infinity);
  const isHovered = useMotionValue(0);

  const maxHeight = useMemo(() => {
    if (!isWide) return panelHeight;
    return Math.max(panelHeight, magnification + magnification / 2 + 4);
  }, [isWide, panelHeight, magnification]);
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight]);
  const height = useSpring(heightRow, spring);

  return (
    <motion.div
      style={{ height, scrollbarWidth: "none" }}
      className={`dock-outer${isWide ? " dock-outer-wide" : layout === "mobile-narrow" ? " dock-outer-mobile-narrow" : " dock-outer-mobile"}`}
    >
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1);
          mouseX.set(pageX);
        }}
        onMouseLeave={() => {
          isHovered.set(0);
          mouseX.set(Infinity);
        }}
        className={`dock-panel${isWide ? " dock-panel-wide" : layout === "mobile-narrow" ? " dock-panel-mobile dock-panel-mobile-narrow" : " dock-panel-mobile"} ${className}`.trim()}
        style={{ minHeight: panelHeight }}
        role="toolbar"
        aria-label="Steps"
      >
        {items.map((item) => (
          <DockItem
            key={item.id}
            onClick={item.onClick}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
          >
            <DockIcon>
              {item.badge != null && item.badge > 0 ? (
                <span className="relative inline-flex">
                  {item.icon}
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                </span>
              ) : (
                item.icon
              )}
            </DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  );
}

export { DockLabel, DockIcon };
