import type { CSSProperties } from "react";
import { Star } from "lucide-react";
import Iphone from "@/components/Iphone";
import { cn } from "@/lib/utils";

export type TemplateId = "classic" | "soft" | "interactive";

interface ProPagePhonePreviewProps {
  template: TemplateId;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  businessName: string;
  fullName?: string;
  /** Optional: show rating (e.g. "5.0") */
  ratingLabel?: string;
  /** `none` drops outer ring/shadow when not using {@link withDeviceFrame}. */
  chrome?: "none" | "default";
  /**
   * When true, wraps content in a generic smartphone frame (~9:20) so chosen colors fill the entire glass;
   * use on Create Pro “Personalize your page”. When false, compact rounded card (e.g. dashboard).
   */
  withDeviceFrame?: boolean;
  /** Match site light/dark theme for the lower “sheet” area of the mock. */
  siteTheme?: "light" | "dark";
}

const hexWithAlpha = (hex: string, alpha: number) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return hex + a;
};

/** One continuous tint behind the whole mock screen (status bar → content). */
function fullScreenPaint(
  template: TemplateId,
  primaryColor: string,
  secondaryColor: string,
  backgroundColor: string
): string {
  const p = primaryColor || "#1e3a5f";
  const s = (secondaryColor || p).trim() || p;
  const bg = (backgroundColor || "#f1f5f9").trim() || "#f1f5f9";
  if (template === "soft") {
    return `linear-gradient(168deg, ${p} 0%, ${s} 38%, ${hexWithAlpha(bg, 0.97)} 78%, ${bg} 100%)`;
  }
  if (template === "interactive") {
    return `radial-gradient(115% 85% at 50% -5%, ${hexWithAlpha(p, 0.55)} 0%, ${p} 42%, ${bg} 100%)`;
  }
  return `linear-gradient(180deg, ${p} 0%, ${hexWithAlpha(p, 0.92)} 22%, ${hexWithAlpha(bg, 0.92)} 62%, ${bg} 100%)`;
}

/** ~iPhone 14 logical aspect: 390×844 → scaled width 274 for form layouts */
const DEVICE_SCREEN_W = 274;
const DEVICE_SCREEN_H = Math.round((844 / 390) * DEVICE_SCREEN_W);

export default function ProPagePhonePreview({
  template,
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  businessName,
  fullName = "",
  ratingLabel = "5.0",
  chrome = "default",
  withDeviceFrame = false,
  siteTheme = "light",
}: ProPagePhonePreviewProps) {
  const paint = fullScreenPaint(template, primaryColor, secondaryColor, backgroundColor);
  const sheetDark = siteTheme === "dark";
  const isSoft = template === "soft";
  const isInteractive = template === "interactive";
  const calendarColor = primaryColor || "#1e3a5f";

  const statusBarStyle: CSSProperties = {
    // subtle “dynamic island” pill — still reads as generic phone, not a notch row
    color: "#fff",
  };

  const outerCardClass =
    chrome === "none"
      ? "mx-auto w-[280px] max-w-full overflow-hidden rounded-[2.25rem]"
      : "mx-auto w-[280px] max-w-full overflow-hidden rounded-[2.25rem] shadow-2xl ring-1 ring-black/12 dark:ring-white/12";

  const screen = (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden",
        withDeviceFrame ? "h-full min-h-0" : "min-h-[420px]"
      )}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: paint }} aria-hidden />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        {/* Status / top bar */}
        <div className="shrink-0 px-3 pb-1 pt-2.5" style={statusBarStyle}>
          <div className="mx-auto mb-2 h-5 w-[28%] max-w-[7rem] rounded-full bg-black/18" aria-hidden />
        </div>

        {/* Hero (text only — paint shows through) */}
        <div className="shrink-0 px-3 pb-4 pt-1 text-white">
          <div className="mb-2 text-[8px] opacity-80">← Back</div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 shrink-0 rounded-full border-2 border-white/35 bg-white/18" />
            <div className="min-w-0 flex-1">
              <h1
                className={cn(
                  "truncate font-heading font-bold text-white drop-shadow-sm",
                  isSoft || isInteractive ? "text-sm" : "text-xs"
                )}
              >
                {businessName}
              </h1>
              <p className="truncate text-[9px] text-white/85">{fullName || "Pro"}</p>
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-[9px] text-white/90">
              <Star size={10} /> {ratingLabel}
            </span>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center justify-between border-t border-white/18 px-3 py-2"
          style={{ backgroundColor: hexWithAlpha(calendarColor, 0.28) }}
        >
          <span className="text-[8px] font-medium text-white/95">Availability</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div
                key={d}
                className="h-2.5 w-2.5 rounded-sm border border-white/35"
                style={{ backgroundColor: hexWithAlpha(calendarColor, 0.55) }}
              />
            ))}
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-auto rounded-t-2xl px-3 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.12)]",
            sheetDark ? "bg-neutral-900/95 text-white" : "bg-white/92 text-neutral-900",
          )}
        >
          <section>
            <h2 className="mb-1.5 font-heading text-xs font-bold">About</h2>
            <div className="h-2 w-full rounded-full opacity-70" style={{ backgroundColor: secondaryColor || "#2C698C" }} />
            <div className="mt-1.5 h-1.5 w-4/5 rounded-full opacity-50" style={{ backgroundColor: accentColor || "#EABB1F" }} />
          </section>
          <section className="mt-3">
            <h2 className="mb-1.5 font-heading text-xs font-bold">Services</h2>
            <div className="flex gap-1.5">
              <div
                className="h-8 flex-1 rounded-md border border-neutral-200/80 shadow-sm"
                style={{ backgroundColor: accentColor || "#EABB1F" }}
              />
              <div
                className="h-8 flex-1 rounded-md border border-neutral-200/80 opacity-85 shadow-sm"
                style={{ backgroundColor: accentColor || "#EABB1F" }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );

  if (withDeviceFrame) {
    return (
      <Iphone
        width={DEVICE_SCREEN_W}
        screenHeight={DEVICE_SCREEN_H}
        className="mx-auto max-w-full drop-shadow-2xl"
        innerClassName="bg-transparent"
      >
        {screen}
      </Iphone>
    );
  }

  return <div className={outerCardClass}>{screen}</div>;
}
