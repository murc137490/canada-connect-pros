import { useLanguage } from "@/contexts/LanguageContext";

export default function HomeHowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { n: "01", title: t.index.step1, desc: t.index.step1Desc },
    { n: "02", title: t.index.step2, desc: t.index.step2Desc },
    { n: "03", title: t.index.step3, desc: t.index.step3Desc },
  ];

  return (
    <section id="how-it-works" className="section-pad border-y border-border/70 bg-muted/35 dark:bg-muted/15">
      <div className="container-page">
        <h2 className="font-display text-display-md text-foreground whitespace-pre-line max-w-xl">
          {t.index.howTitle}
        </h2>

        <ol className="relative mt-14 md:mt-20">
          {/* Desktop horizontal rail */}
          <div
            className="pointer-events-none absolute left-[8%] right-[8%] top-[1.35rem] hidden h-px bg-border md:block"
            aria-hidden
          />

          <div className="grid gap-0 md:grid-cols-3 md:gap-10">
            {steps.map((step, i) => (
              <li key={step.n} className="relative flex gap-5 md:block md:gap-0">
                {/* Mobile vertical connector */}
                {i < steps.length - 1 && (
                  <span
                    className="absolute left-[0.85rem] top-10 bottom-0 w-px bg-border md:hidden"
                    aria-hidden
                  />
                )}
                <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold tabular-nums text-foreground md:mb-6 md:h-auto md:w-auto md:border-0 md:bg-transparent md:text-left">
                  <span className="md:font-display md:text-5xl lg:text-6xl md:text-primary/25 md:leading-none">
                    {step.n}
                  </span>
                </span>
                <div className="pb-10 md:pb-0">
                  <h3 className="font-heading text-lg md:text-xl font-bold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-xs text-[15px] text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </div>
        </ol>
      </div>
    </section>
  );
}
