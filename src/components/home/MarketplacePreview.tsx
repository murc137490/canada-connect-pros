import { MapPin, Star, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { MarketplaceMatchState } from "@/motion/types";

type Props = {
  className?: string;
  variant?: "hero" | "dark";
  matchState?: MarketplaceMatchState;
  requestLabel?: string;
};

/** Desktop-style browser mock — wide on PC, compact (not zoomed) on phones. */
export default function MarketplacePreview({
  className,
  variant = "hero",
  matchState = "idle",
  requestLabel,
}: Props) {
  const { t } = useLanguage();
  const dark = variant === "dark";
  const showCards =
    matchState === "matching" || matchState === "matched" || matchState === "success" || matchState === "idle";
  const searching = matchState === "searching";
  const highlight = matchState === "matched" || matchState === "success";

  const quotes = [
    {
      name: t.index.mockPro1Name,
      rating: t.index.mockPro1Rating,
      avail: t.index.mockPro1Avail,
      price: t.index.mockPro1Price,
      featured: true,
    },
    {
      name: t.index.mockPro2Name,
      rating: t.index.mockPro2Rating,
      avail: t.index.mockPro2Avail,
      price: t.index.mockPro2Price,
      featured: false,
    },
    {
      name: t.index.mockPro3Name,
      rating: t.index.mockPro3Rating,
      avail: t.index.mockPro3Avail,
      price: t.index.mockPro3Price,
      featured: false,
    },
  ];

  const visibleCount =
    matchState === "idle"
      ? 3
      : matchState === "matching"
        ? 1
        : matchState === "matched" || matchState === "success"
          ? 3
          : 0;

  const visibleQuotes = quotes.slice(0, visibleCount === 1 ? 1 : 3).filter((_, i) => {
    if (matchState === "matching" && i > 0) return false;
    return true;
  });

  return (
    <div className={cn("relative w-full max-w-full", className)} aria-hidden>
      {!dark && (
        <div
          className="absolute -inset-x-2 -inset-y-3 -z-10 rounded-sm bg-primary/[0.04] md:-inset-x-4 md:-inset-y-5"
          style={{ transform: "rotate(-0.6deg)" }}
        />
      )}

      <div
        className={cn(
          "overflow-hidden border shadow-[0_20px_50px_-32px_hsl(222_40%_16%/0.45)]",
          dark
            ? "border-white/12 bg-[#0c1424] text-white shadow-none"
            : "border-border bg-card text-foreground"
        )}
        style={{ borderRadius: "12px" }}
      >
        {/* Browser chrome */}
        <div
          className={cn(
            "flex items-center gap-2 border-b px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5",
            dark ? "border-white/10 bg-white/[0.03]" : "border-border/80 bg-muted/50"
          )}
        >
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 pl-0.5">
            <span className={cn("h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5", dark ? "bg-white/25" : "bg-[#ff5f57]")} />
            <span className={cn("h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5", dark ? "bg-white/25" : "bg-[#febc2e]")} />
            <span className={cn("h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5", dark ? "bg-white/25" : "bg-[#28c840]")} />
          </div>

          <div
            className={cn(
              "min-w-0 flex-1 truncate rounded-md px-2.5 py-1 text-center text-[10px] font-medium tracking-wide sm:px-3 sm:text-[11px]",
              dark ? "bg-white/[0.06] text-white/55" : "bg-background text-muted-foreground"
            )}
          >
            premierservices.ca
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className="mp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-[0.12em]",
                dark ? "text-white/50" : "text-muted-foreground"
              )}
            >
              {t.index.mockLive}
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-5 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[9px] font-bold uppercase tracking-[0.16em] sm:text-[10px]",
                  dark ? "text-white/40" : "text-muted-foreground"
                )}
              >
                {t.index.mockRequestLabel}
              </p>
              <p
                className={cn(
                  "mt-1.5 font-display text-[1.2rem] leading-[1.15] tracking-tight sm:mt-2 sm:text-[1.45rem] md:text-[1.65rem]",
                  dark ? "text-white" : "text-foreground"
                )}
              >
                {requestLabel || t.index.mockRequestTitle}
              </p>

              <div
                className={cn(
                  "mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:mt-3 sm:text-[13px]",
                  dark ? "text-white/60" : "text-muted-foreground"
                )}
              >
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {t.index.mockRequestLocation}
                </span>
                <span className={dark ? "text-white/25" : "text-border"}>·</span>
                <span className={cn("font-semibold", dark ? "text-accent" : "text-primary")}>
                  {searching ? t.index.motionSearching : t.index.mockProsAvailable}
                </span>
              </div>
            </div>

            <span
              className={cn(
                "shrink-0 self-start rounded-md px-2 py-1 text-[10px] font-semibold sm:text-[11px]",
                dark ? "bg-white/10 text-white/80" : "bg-primary text-primary-foreground"
              )}
            >
              {t.index.mockToday}
            </span>
          </div>

          <div
            className={cn(
              "mt-4 min-h-0 sm:mt-5",
              searching
                ? "space-y-2"
                : "grid grid-cols-1 gap-2 sm:gap-2.5 md:grid-cols-3"
            )}
          >
            {searching && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm sm:px-3.5 sm:py-4",
                  dark ? "border-white/10 text-white/70" : "border-border text-muted-foreground"
                )}
              >
                <span className="mp-live-dot h-2 w-2 rounded-full bg-accent" />
                {t.index.motionSearching}
              </div>
            )}

            {showCards &&
              !searching &&
              visibleQuotes.map((pro) => {
                const featured = pro.featured && (highlight || matchState === "idle");
                return (
                  <div
                    key={pro.name}
                    className={cn(
                      "border px-3 py-2.5 sm:px-3.5 sm:py-3",
                      dark
                        ? featured
                          ? "border-white/20 bg-white/[0.07]"
                          : "border-white/10 bg-transparent"
                        : featured
                          ? "border-primary/25 bg-primary/[0.03]"
                          : "border-border/80 bg-background",
                      highlight && !pro.featured && "opacity-55"
                    )}
                    style={{ borderRadius: "8px" }}
                  >
                    <div className="flex items-start justify-between gap-2 md:flex-col md:gap-3 lg:flex-row lg:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-accent sm:text-[12px]">
                          <Star className="h-3 w-3 fill-current" />
                          <span>{pro.rating}</span>
                        </div>
                        <p
                          className={cn(
                            "mt-1 truncate text-[13px] font-bold sm:text-sm",
                            dark ? "text-white" : "text-foreground"
                          )}
                        >
                          {pro.name}
                        </p>
                        <p className={cn("mt-0.5 text-[11px] sm:text-xs", dark ? "text-white/50" : "text-muted-foreground")}>
                          {pro.avail}
                        </p>
                      </div>
                      <div className="text-right shrink-0 md:text-left lg:text-right">
                        <p
                          className={cn(
                            "text-[13px] font-bold tabular-nums sm:text-sm",
                            dark ? "text-white" : "text-foreground"
                          )}
                        >
                          {pro.price}
                        </p>
                        {featured && (
                          <span
                            className={cn(
                              "mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold sm:mt-2 sm:text-[11px]",
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
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
