import { Link } from "react-router-dom";
import { LiquidButton } from "@/components/ui/liquid-button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Check } from "lucide-react";
import SpotlightCard from "@/components/SpotlightCard";
import GradientText from "@/components/GradientText";
import "./ProPlansContent.css";

const SPOTLIGHT_STARTER = "rgba(96, 165, 250, 0.2)";   // faint blue
const SPOTLIGHT_GROWTH = "rgba(34, 197, 94, 0.35)";    // stronger green
// Pro: purple and orange gradient (uses CSS var for position)
const SPOTLIGHT_PRO_GRADIENT = "radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(168, 85, 247, 0.3), rgba(249, 115, 22, 0.2), transparent 70%)";

function TierCard({
  name,
  price,
  bestFor,
  features,
  includedStatement,
  spotlightColor,
  spotlightGradient,
  nameVariant,
}: {
  name: string;
  price: string;
  bestFor: string;
  features: string[];
  includedStatement?: string;
  spotlightColor?: string;
  spotlightGradient?: string;
  nameVariant: "starter" | "growth" | "pro";
}) {
  const nameEl =
    nameVariant === "starter" ? (
      <h3 className="font-heading text-xl font-bold mb-1">
        <GradientText colors={["#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#93c5fd"]} animationSpeed={6} showBorder={false} className="text-xl font-bold">
          {name}
        </GradientText>
      </h3>
    ) : nameVariant === "growth" ? (
      <h3 className="font-heading text-xl font-bold mb-1">
        <GradientText colors={["#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#22c55e"]} animationSpeed={6} showBorder={false} className="text-xl font-bold">
          {name}
        </GradientText>
      </h3>
    ) : (
      <h3 className="font-heading text-xl font-bold mb-1">
        <GradientText colors={["#a855f7", "#f97316"]} animationSpeed={6} showBorder={false} className="text-xl font-bold">
          {name}
        </GradientText>
      </h3>
    );

  return (
    <SpotlightCard
      spotlightColor={spotlightColor}
      spotlightGradient={spotlightGradient}
      className="h-full min-h-[420px] !bg-card !border-border border rounded-2xl p-0 overflow-hidden"
    >
      <div className="relative h-full min-h-[420px] p-6 flex flex-col text-foreground">
        <span className="absolute top-4 right-4 font-logo text-2xl text-primary opacity-60" aria-hidden>
          P
        </span>
        {nameEl}
        <p className="text-2xl font-bold text-white mb-4">{price}</p>
        {includedStatement ? (
          <p className="text-sm text-muted-foreground mb-3 font-medium">{includedStatement}</p>
        ) : null}
        <ul className="space-y-2 flex-1 text-sm text-muted-foreground overflow-y-auto min-h-0 pr-1">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className={`size-4 shrink-0 mt-0.5 tier-check--${nameVariant}`} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border shrink-0">
          {bestFor}
        </p>
      </div>
    </SpotlightCard>
  );
}

type ProPlansContentProps = {
  title?: string;
  subtitle?: string;
  showCompleteProfileCta?: boolean;
};

export default function ProPlansContent({ title, subtitle, showCompleteProfileCta = true }: ProPlansContentProps = {}) {
  const { t } = useLanguage();
  const plans = t.plans;
  const starterFeatures = plans?.starterFeatures ?? [];
  const growthFeatures = plans?.growthFeatures ?? [];
  const proAddOnFeatures = plans?.proAddOnFeatures ?? [];

  const displayTitle = title ?? plans?.title ?? "Pro Plans";
  const displaySubtitle = subtitle ?? plans?.subtitle ?? "Choose the plan that fits your business. Upgrade or downgrade anytime.";

  return (
    <div className="w-full relative z-10">
      <div className="text-center mb-10 md:mb-14">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">
          {displayTitle}
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {displaySubtitle}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto items-stretch relative z-10">
        <div className="min-h-[420px] flex">
          <TierCard
            name={plans?.starter ?? "Starter"}
            price={plans?.priceStarter ?? "CA$20 / month"}
            bestFor={`${plans?.bestFor ?? "Best for:"} ${plans?.bestForStarter ?? ""}`}
            features={starterFeatures}
            spotlightColor={SPOTLIGHT_STARTER}
            nameVariant="starter"
          />
        </div>
        <div className="min-h-[420px] flex">
          <TierCard
            name={plans?.growth ?? "Growth"}
            price={plans?.priceGrowth ?? "CA$27 / month"}
            bestFor={`${plans?.bestFor ?? "Best for:"} ${plans?.bestForGrowth ?? ""}`}
            features={growthFeatures}
            spotlightColor={SPOTLIGHT_GROWTH}
            nameVariant="growth"
          />
        </div>
        <div className="min-h-[420px] flex">
          <TierCard
            name={plans?.pro ?? "Pro"}
            price={plans?.pricePro ?? "CA$32 / month"}
            bestFor={`${plans?.bestFor ?? "Best for:"} ${plans?.bestForPro ?? ""}`}
            features={proAddOnFeatures}
            includedStatement={plans?.proIncludesGrowth}
            spotlightGradient={SPOTLIGHT_PRO_GRADIENT}
            nameVariant="pro"
          />
        </div>
      </div>

      <section className="mt-16 md:mt-24 max-w-3xl mx-auto relative z-0 pt-8 pb-8">
        <h3 className="font-heading text-xl font-bold text-foreground mb-6">
          {plans?.sectionTitle ?? "What the Growth & Pro Tier Tools Actually Do"}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {plans?.sectionIntro ?? "Growth and Pro tiers include powerful retention and automation tools for professionals."}
        </p>

        <div className="space-y-8">
          <div>
            <h4 className="font-semibold text-foreground mb-2">{plans?.crmTitle ?? "Client History Dashboard (CRM)"}</h4>
            <p className="text-sm text-muted-foreground mb-2">
              {plans?.crmDesc}
            </p>
            <p className="text-xs text-muted-foreground italic">
              {plans?.crmExample}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">{plans?.repeatTitle ?? "Automatic Repeat Booking System"}</h4>
            <p className="text-sm text-muted-foreground">
              {plans?.repeatDesc}
            </p>
            {plans?.repeatBenefits ? (
              <p className="text-xs text-muted-foreground mt-2">{plans.repeatBenefits}</p>
            ) : null}
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">{plans?.proToolsTitle ?? "Pro Tier: Automation & Communication"}</h4>
            <p className="text-sm text-muted-foreground">
              {plans?.proToolsDesc ?? "Pro adds unlimited leads, SMS appointment reminders and booking confirmations, an AI response assistant for messages, and automated review requests—so you spend less time on admin and more time on the job."}
            </p>
          </div>
        </div>
      </section>

      {showCompleteProfileCta && (
        <div className="mt-12 text-center">
          <LiquidButton size="lg" asChild whiteUntilHover>
            <Link to="/create-pro-account">{t.joinPros.completeProfile}</Link>
          </LiquidButton>
        </div>
      )}
    </div>
  );
}
