import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import type { ServiceCategory } from "@/data/services";

const iconMap: Record<string, React.ComponentType<any>> = {
  Home: Icons.Home,
  TreePine: Icons.TreePine,
  Sparkles: Icons.Sparkles,
  Briefcase: Icons.Briefcase,
  PartyPopper: Icons.PartyPopper,
  GraduationCap: Icons.GraduationCap,
  PawPrint: Icons.PawPrint,
  Heart: Icons.Heart,
  Truck: Icons.Truck,
  Shield: Icons.Shield,
};

export default function CategoryCard({ category }: { category: ServiceCategory }) {
  const Icon = iconMap[category.icon] || Icons.Layers;
  const serviceCount = category.subcategories.reduce((a, s) => a + s.services.length, 0);

  return (
    <Link
      to={`/services/${category.slug}`}
      className="group block bg-card rounded-2xl p-6 card-hover border"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${category.color}/10`}>
          <Icon size={24} className={`text-${category.color}`} />
        </div>
        <ChevronRight
          size={20}
          className="text-muted-foreground group-hover:text-secondary transition-colors group-hover:translate-x-1 duration-200"
        />
      </div>
      <h3 className="font-heading font-bold text-lg text-card-foreground mb-1">{category.name}</h3>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{category.description}</p>
      <span className="text-xs font-medium text-secondary">{serviceCount} services</span>
    </Link>
  );
}
