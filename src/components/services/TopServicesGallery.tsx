import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { popularServiceVisuals } from "@/data/categoryVisuals";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/components/services/top-services-gallery.css";

type GalleryService = { slug: string; name: string; category: string; categorySlug: string };

export default function TopServicesGallery({ items, onGuardClick, modeSearch = "" }: {
  items: GalleryService[];
  onGuardClick?: (event: React.MouseEvent) => void;
  modeSearch?: string;
}) {
  const { locale } = useLanguage();
  const [active, setActive] = useState(0);

  return (
    <div className="top-services-gallery" role="list" aria-label={locale === "fr" ? "Services populaires" : "Popular services"}>
      {items.slice(0, 5).map((service, index) => {
        const title = getServiceName(service.slug, locale, service.name);
        return (
          <Link
            key={`${service.categorySlug}-${service.slug}`}
            to={`/services/${service.categorySlug}/${service.slug}${modeSearch}`}
            onClick={onGuardClick}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onClickCapture={() => setActive(index)}
            style={{ backgroundImage: `url("${popularServiceVisuals[service.slug] ?? popularServiceVisuals["plumbing-services"]}")` }}
            className={`top-services-gallery__panel${active === index ? " is-active" : ""}`}
            aria-label={title}
            role="listitem"
          >
            <span className="top-services-gallery__shade" />
            <span className="top-services-gallery__copy">
              <span className="top-services-gallery__category">{getCategoryName({ name: service.category, slug: service.categorySlug }, locale)}</span>
              <span className="top-services-gallery__title">{title}</span>
            </span>
            <span className="top-services-gallery__arrow"><ChevronRight size={18} /></span>
          </Link>
        );
      })}
    </div>
  );
}
