import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type HomeChapterTone = "default" | "muted" | "primary" | "warm";

interface HomeChapterProps {
  id?: string;
  eyebrow?: string;
  title: string;
  support?: string;
  children?: ReactNode;
  cta?: ReactNode;
  tone?: HomeChapterTone;
  className?: string;
  align?: "left" | "center";
  compact?: boolean;
}

const toneClass: Record<HomeChapterTone, string> = {
  default: "bg-background text-foreground",
  muted: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
  warm: "bg-background text-foreground",
};

export default function HomeChapter({
  id,
  eyebrow,
  title,
  support,
  children,
  cta,
  tone = "default",
  className,
  align = "center",
  compact = false,
}: HomeChapterProps) {
  const onPrimary = tone === "primary";

  return (
    <section
      id={id}
      className={cn(
        "home-chapter relative overflow-hidden",
        toneClass[tone],
        compact ? "py-14 md:py-20" : "py-16 md:py-28",
        className
      )}
    >
      <div className="container px-4 md:px-6">
        <div
          className={cn(
            "mx-auto max-w-3xl home-chapter-reveal",
            align === "center" ? "text-center" : "text-left md:max-w-2xl md:mx-0"
          )}
        >
          {eyebrow ? (
            <p
              className={cn(
                "mb-3 text-xs font-semibold uppercase tracking-[0.18em] md:mb-4 md:text-sm",
                onPrimary ? "text-primary-foreground/70" : "text-secondary"
              )}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={cn(
              "font-heading text-3xl font-extrabold tracking-tight md:text-5xl md:leading-[1.1]",
              onPrimary ? "text-primary-foreground" : "text-foreground"
            )}
          >
            {title}
          </h2>
          {support ? (
            <p
              className={cn(
                "mt-4 max-w-2xl text-base leading-relaxed md:mt-5 md:text-lg",
                align === "center" && "mx-auto",
                onPrimary ? "text-primary-foreground/75" : "text-muted-foreground"
              )}
            >
              {support}
            </p>
          ) : null}
          {cta ? <div className={cn("mt-8", align === "center" && "flex justify-center")}>{cta}</div> : null}
        </div>
        {children ? <div className="home-chapter-reveal mt-10 md:mt-14">{children}</div> : null}
      </div>
    </section>
  );
}
