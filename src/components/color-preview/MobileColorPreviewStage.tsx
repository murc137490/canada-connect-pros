import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MobileColorPreviewStageProps {
  /** Layout variant; `embedded` is used on create-pro color step. */
  skin?: "embedded" | string;
  /** Optional caption above the preview. */
  previewLabel?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Lightweight frame for the pro page color mockup on Create Pro / similar flows.
 * Keeps spacing and label consistent without pulling in the full device chrome.
 */
export default function MobileColorPreviewStage({
  skin: _skin = "embedded",
  previewLabel,
  className,
  children,
}: MobileColorPreviewStageProps) {
  return (
    <div className={cn("flex w-full min-h-0 flex-col items-stretch gap-3", className)}>
      {previewLabel ? (
        <p className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {previewLabel}
        </p>
      ) : null}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">{children}</div>
    </div>
  );
}
