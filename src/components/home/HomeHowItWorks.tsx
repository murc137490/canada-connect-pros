import { useLanguage } from "@/contexts/LanguageContext";

export default function HomeHowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { n: "01", title: t.index.step1, desc: t.index.step1Desc },
    { n: "02", title: t.index.step2, desc: t.index.step2Desc },
    { n: "03", title: t.index.step3, desc: t.index.step3Desc },
  ];

  return (
    <section id="how-it-works" className="section-pad bg-muted/40 dark:bg-muted/20">
      <div className="container-page">
        <div className="max-w-2xl">
          <h2 className="font-display text-display-md text-foreground tracking-tight whitespace-pre-line">
            {t.index.howTitle}
          </h2>
          <p className="mt-3 text-base md:text-lg text-muted-foreground leading-relaxed">
            {t.index.howSupport}
          </p>
        </div>

        <ol className="mt-12 md:mt-16 relative grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-px bg-border md:block"
            aria-hidden
          />
          {steps.map((step) => (
            <li key={step.n} className="relative">
              <p className="font-display text-5xl md:text-6xl text-primary/20 tabular-nums leading-none">
                {step.n}
              </p>
              <h3 className="mt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed max-w-sm">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
