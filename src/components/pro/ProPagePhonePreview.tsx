import { Star } from "lucide-react";
import Iphone from "@/components/Iphone";

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
}

const hexWithAlpha = (hex: string, alpha: number) => {
  const a = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return hex + a;
};

export default function ProPagePhonePreview({
  template,
  primaryColor,
  secondaryColor,
  accentColor,
  backgroundColor,
  businessName,
  fullName = "",
  ratingLabel = "5.0",
}: ProPagePhonePreviewProps) {
  const heroStyle: React.CSSProperties = { color: "#fff" };
  if (template === "soft" && primaryColor && secondaryColor) {
    heroStyle.backgroundImage = `linear-gradient(145deg, ${primaryColor} 0%, ${secondaryColor} 60%, ${primaryColor} 100%)`;
  } else if (template === "interactive" && primaryColor) {
    heroStyle.background = `radial-gradient(circle at 50% 50%, ${hexWithAlpha(primaryColor, 0.3)}, ${primaryColor})`;
  } else {
    heroStyle.backgroundColor = primaryColor || "#1e3a5f";
  }

  const contentFade =
    backgroundColor && primaryColor
      ? template === "soft"
        ? `linear-gradient(180deg, ${backgroundColor} 0%, ${hexWithAlpha(primaryColor, 0.08)} 100%)`
        : `linear-gradient(180deg, ${backgroundColor} 0%, ${backgroundColor} 50%, ${hexWithAlpha(primaryColor, 0.12)} 100%)`
      : backgroundColor || "#f1f5f9";

  const isSoft = template === "soft";
  const isInteractive = template === "interactive";
  const calendarColor = primaryColor || "#1e3a5f";

  return (
    <Iphone width={280} className="mx-auto">
      <div
        className="overflow-hidden min-h-full"
        style={{ minHeight: "420px", background: contentFade }}
      >
        {/* Hero */}
        <div
          className="px-3 pt-8 pb-4"
          style={heroStyle}
        >
          <div className="mb-2 text-[8px] opacity-80">← Back</div>
          <div className="flex items-center gap-2">
            <div
              className="h-10 w-10 shrink-0 rounded-full border-2 border-white/30 bg-white/20"
            />
            <div className="min-w-0 flex-1">
              <h1
                className={`truncate font-heading text-white ${isSoft || isInteractive ? "text-sm font-bold" : "text-xs font-bold"}`}
              >
                {businessName}
              </h1>
              <p className="truncate text-[9px] text-white/80">{fullName || "Pro"}</p>
            </div>
            <span className="flex items-center gap-0.5 text-[9px] text-white/90">
              <Star size={10} /> {ratingLabel}
            </span>
          </div>
        </div>

        {/* Available days strip – uses primary color, updates in real time when color scheme changes */}
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{ backgroundColor: calendarColor }}
        >
          <span className="text-[8px] text-white/90 font-medium">Availability</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div
                key={d}
                className="w-2.5 h-2.5 rounded-sm border border-white/30"
                style={{ backgroundColor: hexWithAlpha(calendarColor, 0.9) }}
              />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="px-3 py-4">
          <section>
            <h2 className="mb-1.5 font-heading text-xs font-bold text-gray-800">About</h2>
            <div className="h-2 w-full rounded-full opacity-60" style={{ backgroundColor: secondaryColor || "#2C698C" }} />
            <div className="mt-1.5 h-1.5 w-4/5 rounded-full opacity-40" style={{ backgroundColor: accentColor || "#EABB1F" }} />
          </section>
          <section className="mt-3">
            <h2 className="mb-1.5 font-heading text-xs font-bold text-gray-800">Services</h2>
            <div className="flex gap-1.5">
              <div className="h-8 flex-1 rounded-md border border-border" style={{ backgroundColor: accentColor || "#EABB1F" }} />
              <div className="h-8 flex-1 rounded-md border border-border opacity-80" style={{ backgroundColor: accentColor || "#EABB1F" }} />
            </div>
          </section>
        </div>
      </div>
    </Iphone>
  );
}
