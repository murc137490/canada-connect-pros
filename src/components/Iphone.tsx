import { cn } from "@/lib/utils";

interface IphoneProps {
  children: React.ReactNode;
  className?: string;
  /** Width of the screen area inside the bezel (default 280px) */
  width?: number;
  /** Height of the screen area inside the bezel (default 480px) */
  screenHeight?: number;
  /** Replaces default `bg-zinc-950` on the inner screen (e.g. `bg-transparent` for full-bleed previews). */
  innerClassName?: string;
}

/** Kept for compatibility; the frame no longer reserves a separate notch row. */
export const IPHONE_NOTCH_BAR_HEIGHT = 0;

/** Bezel thickness (px); must match `p-[10px]` on the frame (padding bezel avoids border-radius seam artifacts). */
export const IPHONE_BEZEL_PX = 10;
/** Screen area corner radius — concentric with outer `rounded-[2.75rem]` minus bezel. */
export const IPHONE_INNER_SCREEN_RADIUS = `calc(2.75rem - ${IPHONE_BEZEL_PX}px)`;

export default function Iphone({
  children,
  className = "",
  width = 280,
  screenHeight = 480,
  innerClassName,
}: IphoneProps) {
  // 10px padding each side → outer width/height include bezel only; inner viewport = width × screenHeight
  const outerW = width + IPHONE_BEZEL_PX * 2;
  const outerH = screenHeight + IPHONE_BEZEL_PX * 2;

  return (
    <div className={cn("mx-auto flex max-w-full flex-col items-center", className)} style={{ width: outerW }}>
      {/* Padding “bezel” instead of border: borders + nested radii often leave 1px light seams at corners. */}
      <div
        className="box-border w-full overflow-hidden rounded-[2.75rem] bg-zinc-800 p-[10px] shadow-2xl dark:bg-zinc-700"
        style={{ height: outerH }}
      >
        <div
          className={cn(
            "box-border flex h-full w-full min-h-0 flex-col overflow-hidden bg-zinc-950",
            innerClassName
          )}
          style={{ minHeight: screenHeight, borderRadius: IPHONE_INNER_SCREEN_RADIUS }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
