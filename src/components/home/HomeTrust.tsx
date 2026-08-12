import { MapPin, Scale, Gift, Hand, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function HomeTrust() {
  const { t } = useLanguage();
  const items = [
    { icon: MapPin, title: t.index.trust1Title, desc: t.index.trust1Desc },
    { icon: Scale, title: t.index.trust2Title, desc: t.index.trust2Desc },
    { icon: Gift, title: t.index.trust3Title, desc: t.index.trust3Desc },
    { icon: Hand, title: t.index.trust4Title, desc: t.index.trust4Desc },
    { icon: ShieldCheck, title: t.index.trust5Title, desc: t.index.trust5Desc },
  ];

  return (
    <section className="section-pad">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="font-display text-display-md text-foreground tracking-tight">
            {t.index.trustTitle}
          </h2>
          <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
            {t.index.trustSupport}
          </p>
        </div>

        <ul className="mt-12 md:mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {items.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="max-w-xs">
              <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
              <h3 className="mt-4 font-heading text-base font-semibold text-foreground tracking-tight">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
