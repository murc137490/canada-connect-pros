import { MapPin, Star, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "hero" | "dark";
};

export default function MarketplacePreview({ className, variant = "hero" }: Props) {
  const { t } = useLanguage();
  const dark = variant === "dark";

  const quotes = [
    {
      name: t.index.mockPro1Name,
      rating: t.index.mockPro1Rating,
      avail: t.index.mockPro1Avail,
      price: t.index.mockPro1Price,
      featured: true,
      delay: "mp-enter-2",
    },
    {
      name: t.index.mockPro2Name,
      rating: t.index.mockPro2Rating,
      avail: t.index.mockPro2Avail,
      price: t.index.mockPro2Price,
      featured: false,
      delay: "mp-enter-3",
    },
    {
      name: t.index.mockPro3Name,
      rating: t.index.mockPro3Rating,
      avail: t.index.mockPro3Avail,
      price: t.index.mockPro3Price,
      featured: false,
      delay: "mp-enter-4",
    },
  ];

  return (
    <div className={cn("relative w-full max-w-[420px] mx-auto", className)} aria-hidden>
      {/* Soft depth plane — not a blob gradient */}
      {!dark && (
        <div
          className="absolute -inset-x-3 -inset-y-4 -z-10 rounded-sm bg-primary/[0.04]"
          style={{ transform: "rotate(-1.2deg)" }}
        />
      )}

      <div
        className={cn(
          "overflow-hidden border",
          dark
            ? "border-white/12 bg-[#0c1424] text-white"
            : "border-border bg-card text-foreground shadow-[0_20px_50px_-32px_hsl(222_40%_16%/0.45)]"
        )}
        style={{ borderRadius: "10px" }}
      >
        {/* App chrome */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b px-4 py-2.5",
            dark ? "border-white/10" : "border-border/80 bg-muted/40"
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", dark ? "bg-white/25" : "bg-border")} />
            <span className={cn("h-2 w-2 rounded-full", dark ? "bg-white/25" : "bg-border")} />
            <span className={cn("h-2 w-2 rounded-full", dark ? "bg-white/25" : "bg-border")} />
          </div>
          <p className={cn("text-[11px] font-semibold tracking-wide", dark ? "text-white/45" : "text-muted-foreground")}>
            premiiereservices.ca
          </p>
          <div className="flex items-center gap-1.5">
            <span className="mp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", dark ? "text-white/50" : "text-muted-foreground")}>
              {t.index.mockLive}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mp-enter">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.16em]",
                    dark ? "text-white/40" : "text-muted-foreground"
                  )}
                >
                  {t.index.mockRequestLabel}
                </p>
                <p
                  className={cn(
                    "mt-2 font-display text-[1.55rem] sm:text-[1.75rem] leading-[1.1] tracking-tight",
                    dark ? "text-white" : "text-foreground"
                  )}
                >
                  {t.index.mockRequestTitle}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold",
                  dark ? "bg-white/10 text-white/80" : "bg-primary text-primary-foreground"
                )}
              >
                {t.index.mockToday}
              </span>
            </div>

            <div
              className={cn(
                "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]",
                dark ? "text-white/60" : "text-muted-foreground"
              )}
            >
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {t.index.mockRequestLocation}
              </span>
              <span className={dark ? "text-white/25" : "text-border"}>·</span>
              <span className={cn("font-semibold", dark ? "text-accent" : "text-primary")}>
                {t.index.mockProsAvailable}
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {quotes.map((pro) => (
              <div
                key={pro.name}
                className={cn(
                  "mp-enter border px-3.5 py-3 transition-colors",
                  pro.delay,
                  dark
                    ? pro.featured
                      ? "border-white/20 bg-white/[0.07]"
                      : "border-white/10 bg-transparent"
                    : pro.featured
                      ? "border-primary/25 bg-primary/[0.03]"
                      : "border-border/80 bg-background"
                )}
                style={{ borderRadius: "8px" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[12px] font-semibold text-accent">
                      <Star className="h-3 w-3 fill-current" />
                      <span>{pro.rating}</span>
                    </div>
                    <p className={cn("mt-1 truncate text-sm font-bold", dark ? "text-white" : "text-foreground")}>
                      {pro.name}
                    </p>
                    <p className={cn("mt-0.5 text-xs", dark ? "text-white/50" : "text-muted-foreground")}>{pro.avail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold tabular-nums", dark ? "text-white" : "text-foreground")}>
                      {pro.price}
                    </p>
                    {pro.featured && (
                      <span
                        className={cn(
                          "mt-2 inline-flex items-center gap-1 text-[11px] font-bold",
                          dark ? "text-white" : "text-primary"
                        )}
                      >
                        {t.index.mockViewQuote}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
