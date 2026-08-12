import { useLanguage } from "@/contexts/LanguageContext";
import ScrollReveal from "@/components/motion/ScrollReveal";

export default function HomeTrust() {
  const { t } = useLanguage();
  const items = [
    { title: t.index.trust1Title, desc: t.index.trust1Desc },
    { title: t.index.trust2Title, desc: t.index.trust2Desc },
    { title: t.index.trust3Title, desc: t.index.trust3Desc },
    { title: t.index.trust4Title, desc: t.index.trust4Desc },
  ];

  return (
    <section className="section-pad">
      <div className="container-page">
        <ScrollReveal y={28}>
          <div className="max-w-2xl md:max-w-none md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:items-start">
            <h2 className="font-display text-display-md text-foreground max-w-[12ch]">
              {t.index.trustTitle}
            </h2>
            <p className="mt-4 md:mt-2 text-[17px] text-muted-foreground leading-relaxed max-w-md">
              {t.index.trustSupport}
            </p>
          </div>
        </ScrollReveal>

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
          {items.map((item, i) => (
            <ScrollReveal key={item.title} y={24} delay={i * 0.05} amount={0.2}>
              <li className="lg:px-8 first:lg:pl-0 last:lg:pr-0">
                <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </li>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
