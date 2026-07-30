import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  blurred: boolean;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  children?: ReactNode;
  className?: string;
  minHeightClass?: string;
};

function BlurPlaceholder() {
  return (
    <div className="space-y-2.5 px-1 py-1" aria-hidden>
      <div className="h-3 w-[88%] rounded-md bg-muted-foreground/25" />
      <div className="h-3 w-full rounded-md bg-muted-foreground/20" />
      <div className="h-3 w-[72%] rounded-md bg-muted-foreground/15" />
      <div className="flex gap-2 pt-1">
        <div className="h-14 w-14 rounded-md bg-muted-foreground/20" />
        <div className="h-14 w-14 rounded-md bg-muted-foreground/15" />
      </div>
    </div>
  );
}

export default function BlurredReviewContent({
  blurred,
  message,
  ctaLabel,
  ctaHref,
  onCtaClick,
  children,
  className,
  minHeightClass = "min-h-[9.5rem]",
}: Props) {
  if (!blurred) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-border/50", minHeightClass, className)}>
      <div className={cn("absolute inset-0 blur-[10px] select-none pointer-events-none", minHeightClass)} aria-hidden>
        <div className="p-3 opacity-70">
          {children}
          <BlurPlaceholder />
        </div>
      </div>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 py-5 text-center",
          "bg-gradient-to-b from-background/92 via-background/88 to-background/95 backdrop-blur-md",
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted border border-border/60 text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground leading-snug max-w-[18rem]">{message}</p>
        {ctaLabel && onCtaClick ? (
          <Button type="button" size="sm" className="h-9 px-4 text-sm font-semibold shadow-sm" onClick={onCtaClick}>
            {ctaLabel}
          </Button>
        ) : null}
        {ctaLabel && ctaHref && !onCtaClick ? (
          <Button type="button" size="sm" className="h-9 px-4 text-sm font-semibold shadow-sm" asChild>
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
