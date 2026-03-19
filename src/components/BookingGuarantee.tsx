import { useLanguage } from "@/contexts/LanguageContext";
import { RefreshCw, Shield, UserCheck } from "lucide-react";

const guaranteeItems = [
  { key: "rebooking" as const, Icon: RefreshCw },
  { key: "quality" as const, Icon: Shield },
  { key: "replacement" as const, Icon: UserCheck },
];

export default function BookingGuarantee() {
  const { t } = useLanguage();

  return (
    <section className="py-12 md:py-16 bg-muted/30">
      <div className="container px-4 md:px-6">
        <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground text-center mb-6 md:mb-8">
          {t.guarantee.title}
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
          {guaranteeItems.map(({ key, Icon }) => (
            <div
              key={key}
              className="rounded-xl border bg-card p-5 md:p-6 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Icon size={24} className="text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-foreground">
                {t.guarantee[key]}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {key === "rebooking" && t.guarantee.rebookingDesc}
                {key === "quality" && t.guarantee.qualityDesc}
                {key === "replacement" && t.guarantee.replacementDesc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
