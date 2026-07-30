import { Link } from "react-router-dom";
import { LiquidButton } from "@/components/ui/liquid-button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";
import SpotlightCard from "@/components/SpotlightCard";
import GradientText from "@/components/GradientText";
import type { ProPlanId } from "@/lib/proPlanPreview";
import { PLAN_TIER_BORDER_CLASS } from "@/lib/planTierTheme";
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
  interactive,
  isCurrent,
  currentPlanLabel,
  onSelect,
}: {
  name: string;
  price: string;
  bestFor: string;
  features: string[];
  includedStatement?: string;
  spotlightColor?: string;
  spotlightGradient?: string;
  nameVariant: ProPlanId;
  interactive?: boolean;
  isCurrent?: boolean;
  currentPlanLabel?: string;
  onSelect?: (tier: ProPlanId) => void;
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

  const inner = (
    <div className="relative h-full min-h-[420px] p-6 flex flex-col text-foreground">
      <div
        className={`mb-2 flex shrink-0 min-w-0 items-start gap-3 ${isCurrent ? "justify-between" : "justify-end"}`}
      >
        {isCurrent ? (
          <div className="min-w-0 flex-1 text-left">
            <span className={`inline-flex max-w-full rounded-md p-[1.5px] align-top ${PLAN_TIER_BORDER_CLASS[nameVariant]}`}>
              <span className="block max-w-full rounded-[calc(0.375rem-1.5px)] bg-card/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide leading-snug text-balance break-words sm:text-xs current-plan-rainbow-heading">
                {currentPlanLabel ?? "Current"}
              </span>
            </span>
          </div>
        ) : null}
        <span className="font-logo shrink-0 text-2xl leading-none text-primary opacity-60" aria-hidden>
          P
        </span>
      </div>
      {nameEl}
        <p className="text-2xl font-bold text-foreground mb-4">{price}</p>
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
  );

  return (
    <SpotlightCard
      spotlightColor={spotlightColor}
      spotlightGradient={spotlightGradient}
      className={`h-full min-h-[420px] !bg-card !border-border border rounded-2xl p-0 overflow-hidden${interactive ? " ring-offset-background" : ""}`}
    >
      {interactive && onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(nameVariant)}
          className="w-full h-full min-h-[420px] p-0 border-0 bg-transparent text-left cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {inner}
        </button>
      ) : (
        inner
      )}
    </SpotlightCard>
  );
}

type ProPlansContentProps = {
  title?: string;
  subtitle?: string;
  showCompleteProfileCta?: boolean;
  /** When true, CTA reads “Edit pro profile” and links to profile setup (existing application). */
  hasProProfile?: boolean;
  profileCtaHref?: string;
  /** When set with onSelectPlan, tier cards open checkout / plan change */
  interactive?: boolean;
  currentPlanId?: ProPlanId | null;
  onSelectPlan?: (plan: ProPlanId) => void;
};

export default function ProPlansContent({
  title,
  subtitle,
  showCompleteProfileCta = true,
  hasProProfile = false,
  profileCtaHref = "/create-pro-account",
  interactive = false,
  currentPlanId = null,
  onSelectPlan,
}: ProPlansContentProps = {}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const plans = t.plans;
  const starterFeatures = plans?.starterFeatures ?? [];
  const growthFeatures = plans?.growthFeatures ?? [];
  const proAddOnFeatures = plans?.proAddOnFeatures ?? [];

  const displayTitle = title ?? plans?.title ?? "Pro Plans";
  const displaySubtitle = subtitle ?? plans?.subtitle ?? "Choose the plan that fits your business. Upgrade or downgrade anytime.";

  const handleTierClick = (tier: ProPlanId) => {
    if (!interactive || !onSelectPlan) return;
    if (currentPlanId === tier) {
      toast({
        title: plans?.alreadyOnPlan ?? "You're already on this plan.",
      });
      return;
    }
    onSelectPlan(tier);
  };

  return (
    <div className="w-full relative z-10">
      <div className="mb-12 text-center md:mb-16">
        <h2 className="mb-3 font-heading text-3xl font-bold text-foreground md:text-4xl">
          {displayTitle}
        </h2>
        <div className="mx-auto inline-block max-w-2xl rounded-xl p-[1.5px] current-plan-rainbow-border">
          <p className="rounded-[calc(0.75rem-1.5px)] bg-card px-3 py-2.5 text-balance text-base font-medium leading-relaxed sm:px-5 sm:py-3 sm:text-lg current-plan-rainbow-heading">
            {displaySubtitle}
          </p>
        </div>
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
            interactive={interactive}
            isCurrent={currentPlanId === "starter"}
            currentPlanLabel={plans?.currentPlanBadge}
            onSelect={interactive && onSelectPlan ? handleTierClick : undefined}
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
            interactive={interactive}
            isCurrent={currentPlanId === "growth"}
            currentPlanLabel={plans?.currentPlanBadge}
            onSelect={interactive && onSelectPlan ? handleTierClick : undefined}
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
            interactive={interactive}
            isCurrent={currentPlanId === "pro"}
            currentPlanLabel={plans?.currentPlanBadge}
            onSelect={interactive && onSelectPlan ? handleTierClick : undefined}
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
              {plans?.proToolsDesc ?? "Pro adds unlimited leads, SMS appointment reminders and booking confirmations, an AI response assistant for messages, and automated review requests - so you spend less time on admin and more time on the job."}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-2">{plans?.platformFeeTitle ?? "5% platform fee on completed transactions"}</h4>
            <p className="text-sm text-muted-foreground">
              {plans?.platformFeeDesc ??
                "Starter, Growth, and Pro: we retain 5% of every completed transaction processed through Premiere Services - jobs that are marked completed and paid via the platform."}
            </p>
          </div>
        </div>
      </section>

      {showCompleteProfileCta && (
        <div className="mt-12 text-center">
          <LiquidButton size="lg" asChild whiteUntilHover>
            <Link to={profileCtaHref}>
              {hasProProfile ? t.joinPros.editProfile : t.joinPros.completeProfile}
            </Link>
          </LiquidButton>
        </div>
      )}
    </div>
  );
}
