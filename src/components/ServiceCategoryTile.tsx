import { useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { ServiceCategory } from "@/data/serviceTypes";
import { getCategoryVisual } from "@/data/categoryVisuals";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import CategoryLottie from "@/components/CategoryLottie";
import { cn } from "@/lib/utils";

type Props = {
  category: ServiceCategory;
  index: number;
  locked?: boolean;
  onGuardClick?: (e: MouseEvent) => void;
  servicesLabel: string;
};

export default function ServiceCategoryTile({
  category,
  index,
  locked,
  onGuardClick,
  servicesLabel,
}: Props) {
  const { locale } = useLanguage();
  const [hover, setHover] = useState(false);
  const visual = getCategoryVisual(category.slug);
  const name = getCategoryName(category, locale);
  const blurb = locale === "fr" ? visual.blurbFr : visual.blurbEn;
  const alt = locale === "fr" ? visual.imageAltFr : visual.imageAltEn;
  const count = category.subcategories.reduce((a, s) => a + s.services.length, 0);
  const featured = index < 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: "-40px", amount: 0.25 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.06, 0.36), ease: [0.22, 1, 0.36, 1] }}
      className={cn(featured ? "md:col-span-2" : "md:col-span-1")}
    >
      <Link
        to={`/services/${category.slug}`}
        onClick={onGuardClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className={cn(
          "group relative block overflow-hidden rounded-3xl border border-border bg-card shadow-sm outline-none transition-shadow duration-300",
          "hover:shadow-xl focus-visible:ring-2 focus-visible:ring-secondary",
          locked && "opacity-90"
        )}
      >
        <div className={cn("relative overflow-hidden", featured ? "aspect-[16/9] md:aspect-[21/9]" : "aspect-[4/3]")}>
          <motion.img
            src={visual.image}
            srcSet={visual.imageSrcSet}
            sizes={featured ? "(min-width: 768px) 90vw, 100vw" : "(min-width: 768px) 45vw, 100vw"}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            animate={{ scale: hover ? 1.06 : 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(120deg, ${visual.accent}ee 0%, ${visual.accent}66 42%, transparent 70%), linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)`,
            }}
          />

          {visual.lottie ? (
            <motion.div
              className="absolute right-3 top-3 h-20 w-20 rounded-2xl bg-white/90 p-1 shadow-md backdrop-blur-sm md:right-5 md:top-5 md:h-24 md:w-24"
              animate={{ opacity: hover ? 1 : 0.85, y: hover ? 0 : 4 }}
              transition={{ duration: 0.35 }}
            >
              <CategoryLottie src={visual.lottie} play={hover} />
            </motion.div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  {count} {servicesLabel}
                </p>
                <h2 className="mt-1 font-heading text-2xl font-extrabold tracking-tight text-white md:text-3xl">
                  {name}
                </h2>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/85 md:text-[15px]">{blurb}</p>
              </div>
              <motion.span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[hsl(222_76%_24%)] shadow-md"
                animate={{ x: hover ? 4 : 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 22 }}
              >
                <ChevronRight size={20} />
              </motion.span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
