import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { MarketplaceMatchState } from "@/motion/types";
import { MOTION } from "@/motion/types";

type Props = {
  onStateChange: (state: MarketplaceMatchState, label?: string) => void;
  className?: string;
};

type Step = 0 | 1 | 2 | 3;

export default function ServiceRequestDemo({ onStateChange, className }: Props) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(0);
  const [service, setService] = useState<string | null>(null);
  const [task, setTask] = useState<string | null>(null);
  const [when, setWhen] = useState<string | null>(null);

  const services = [
    { id: "plumbing", label: t.index.demoServicePlumbing },
    { id: "cleaning", label: t.index.demoServiceCleaning },
    { id: "electrical", label: t.index.demoServiceElectrical },
  ];
  const tasks = [
    { id: "repair", label: t.index.demoTaskRepair },
    { id: "install", label: t.index.demoTaskInstall },
    { id: "other", label: t.index.demoTaskOther },
  ];
  const whens = [
    { id: "today", label: t.index.demoWhenToday },
    { id: "week", label: t.index.demoWhenWeek },
  ];

  useEffect(() => {
    onStateChange("idle");
  }, [onStateChange]);

  const pickService = (id: string, label: string) => {
    setService(label);
    setStep(1);
    onStateChange("request", label);
  };

  const pickTask = (label: string) => {
    setTask(label);
    setStep(2);
    onStateChange("request", service || undefined);
  };

  const pickWhen = (label: string) => {
    setWhen(label);
    setStep(3);
    onStateChange("hover", service || undefined);
  };

  const runMatch = () => {
    onStateChange("searching", service || undefined);
    window.setTimeout(() => onStateChange("matching", service || undefined), 700);
    window.setTimeout(() => onStateChange("matched", service || undefined), 1400);
    window.setTimeout(() => onStateChange("success", service || undefined), 2000);
  };

  const reset = () => {
    setStep(0);
    setService(null);
    setTask(null);
    setWhen(null);
    onStateChange("idle");
  };

  const Chip = ({
    active,
    children,
    onClick,
  }: {
    active?: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2 text-[13px] font-semibold transition-colors duration-200",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn("max-w-xl", className)}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t.index.demoEyebrow}
      </p>

      <div className="mt-3 min-h-[7.5rem]">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            >
              <p className="text-sm font-semibold text-foreground">{t.index.demoQService}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {services.map((s) => (
                  <Chip key={s.id} onClick={() => pickService(s.id, s.label)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            >
              <p className="text-sm font-semibold text-foreground">{t.index.demoQTask}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tasks.map((s) => (
                  <Chip key={s.id} onClick={() => pickTask(s.label)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            >
              <p className="text-sm font-semibold text-foreground">{t.index.demoQWhen}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {whens.map((s) => (
                  <Chip key={s.id} onClick={() => pickWhen(s.label)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{service}</span>
                {task ? ` · ${task}` : ""}
                {when ? ` · ${when}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="lg" className="group h-10 px-5" onClick={runMatch}>
                  {t.index.demoFindPros}
                  <ArrowRight className="cta-arrow h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  {t.index.demoReset}
                </Button>
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to="/make-request">{t.index.ctaPublish}</Link>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
