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

  return (
    <div
      className={cn(
        "relative w-full max-w-md mx-auto",
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          "rounded-2xl border p-4 sm:p-5",
          dark
            ? "border-white/10 bg-white/[0.06] text-white"
            : "border-border/80 bg-card text-foreground shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-28px_hsl(222_40%_20%/0.28)]"
        )}
      >
        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/50" : "text-muted-foreground")}>
          {t.index.mockRequestLabel}
        </p>
        <p className={cn("mt-2 font-display text-xl sm:text-2xl leading-snug tracking-tight", dark ? "text-white" : "text-foreground")}>
          {t.index.mockRequestTitle}
        </p>
        <div className={cn("mt-3 inline-flex items-center gap-1.5 text-sm", dark ? "text-white/70" : "text-muted-foreground")}>
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{t.index.mockRequestLocation}</span>
        </div>
        <p className={cn("mt-3 text-sm font-medium", dark ? "text-accent" : "text-primary")}>
          {t.index.mockProsAvailable}
        </p>

        <div className="mt-4 space-y-2.5">
          {[
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
          ].map((pro) => (
            <div
              key={pro.name}
              className={cn(
                "rounded-xl border px-3.5 py-3 transition-colors",
                dark
                  ? pro.featured
                    ? "border-white/20 bg-white/[0.08]"
                    : "border-white/10 bg-transparent"
                  : pro.featured
                    ? "border-primary/20 bg-muted/50"
                    : "border-border/70 bg-background"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-accent">
                    <Star className="h-3 w-3 fill-current" />
                    <span>{pro.rating}</span>
                  </div>
                  <p className={cn("mt-1 truncate text-sm font-semibold", dark ? "text-white" : "text-foreground")}>
                    {pro.name}
                  </p>
                  <p className={cn("mt-0.5 text-xs", dark ? "text-white/55" : "text-muted-foreground")}>{pro.avail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-semibold tabular-nums", dark ? "text-white" : "text-foreground")}>
                    {pro.price}
                  </p>
                  {pro.featured && (
                    <span
                      className={cn(
                        "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold",
                        dark ? "text-white/80" : "text-primary"
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
  );
}
