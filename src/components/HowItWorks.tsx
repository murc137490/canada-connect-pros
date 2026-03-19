import { Search, Users, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import SplitText from "@/components/SplitText";

const stepKeys = ["step1", "step2", "step3"] as const;
const stepIcons = [Search, Users, CheckCircle];

export default function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="py-12 md:py-24">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-8 md:mb-14">
          <SplitText
            text={t.index.howItWorks}
            className="font-heading text-3xl md:text-5xl font-extrabold text-foreground dark:text-white mb-3 md:mb-4 block"
            tag="h2"
            splitType="chars"
            delay={40}
            duration={1}
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            threshold={0.1}
            rootMargin="-80px"
            textAlign="center"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto">
          {stepKeys.map((key, i) => {
            const Icon = stepIcons[i];
            return (
              <div
                key={key}
                className="content-panel glass-hover text-center rounded-2xl md:rounded-3xl p-5 md:p-7 space-y-2.5 md:space-y-3.5 shadow-lg transition-transform duration-200 ease-out hover:-translate-y-2 bg-card border border-border text-foreground dark:text-white"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto border border-border">
                  <Icon size={30} className="text-primary" />
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {i + 1}
                </div>
                <h3 className="font-heading font-bold text-base md:text-lg text-foreground dark:text-white leading-snug">
                  {t.index[key]}
                </h3>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
