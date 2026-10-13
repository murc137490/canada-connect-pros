import { useLanguage } from "@/contexts/LanguageContext";
import ScrollReveal from "@/components/motion/ScrollReveal";
import ScrollFloat from "@/components/motion/ScrollFloat";
import TextType from "@/components/motion/TextType";
import { usePrefersReducedMotion } from "@/motion/usePrefersReducedMotion";

export default function HomeTrust() {
  const { t } = useLanguage();
  const reduced = usePrefersReducedMotion();
  const items = [
    { title: t.index.trust1Title, desc: t.index.trust1Desc },
    { title: t.index.trust2Title, desc: t.index.trust2Desc },
    { title: t.index.trust3Title, desc: t.index.trust3Desc },
    { title: t.index.trust4Title, desc: t.index.trust4Desc },
  ];

  return (
    <section className="section-pad">
      <div className="container-page">
        <ScrollReveal>
          <div className="max-w-2xl md:max-w-none md:grid md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:items-start">
            <h2 className="font-display text-display-md text-foreground max-w-[12ch]">
              <ScrollFloat>{t.index.trustTitle}</ScrollFloat>
            </h2>
            {t.index.trustSupport ? (
              <p className="mt-4 md:mt-2 text-[17px] text-muted-foreground leading-relaxed max-w-md">
                {t.index.trustSupport}
              </p>
            ) : null}
          </div>
        </ScrollReveal>

        {reduced ? (
          <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border">
            {items.map((item) => <li key={item.title} className="lg:px-8 first:lg:pl-0 last:lg:pr-0"><h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p></li>)}
          </ul>
        ) : (
          <ScrollReveal>
            <div className="mt-14 min-h-32 border-y border-border/60 py-8 text-center sm:py-10" aria-live="off">
              <p className="sr-only">{items.map((item) => `${item.title}. ${item.desc}`).join(" ")}</p>
              <TextType
                as="span"
                aria-hidden="true"
                text={items.map((item) => `${item.title}\n${item.desc}`)}
                typingSpeed={48}
                deletingSpeed={22}
                pauseDuration={1700}
                initialDelay={250}
                showCursor
                cursorCharacter="|"
                startOnVisible
                className="whitespace-pre-line font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl"
              />
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  );
}
