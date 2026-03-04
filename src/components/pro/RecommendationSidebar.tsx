import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import ProCard, { type ProCardData } from "./ProCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface RecommendationSidebarProps {
  currentProId: string;
  serviceSlug?: string;
  categorySlug?: string;
}

export default function RecommendationSidebar({
  currentProId,
  serviceSlug,
  categorySlug,
}: RecommendationSidebarProps) {
  const [pros, setPros] = useState<ProCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSimilarPros = async () => {
      setLoading(true);

      // Get pros offering similar services
      let query = supabase
        .from("pro_profiles")
        .select("*")
        .neq("id", currentProId)
        .limit(5);

      const { data: proData } = await query;
      if (!proData) { setLoading(false); return; }

      const enriched: ProCardData[] = [];
      for (const pro of proData) {
        // Get rating
        const { data: ratingData } = await supabase.rpc("get_pro_avg_rating", {
          p_pro_profile_id: pro.id,
        });
        const avgRating = ratingData?.[0]?.avg_rating || 0;
        const reviewCount = ratingData?.[0]?.review_count || 0;

        // Get name
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", pro.user_id)
          .single();

        // Check license
        const { data: licenses } = await supabase
          .from("pro_licenses")
          .select("is_verified")
          .eq("pro_profile_id", pro.id)
          .eq("is_verified", true)
          .limit(1);

        // Get service info
        const { data: services } = await supabase
          .from("pro_services")
          .select("service_slug, category_slug")
          .eq("pro_profile_id", pro.id)
          .limit(1);

        enriched.push({
          id: pro.id,
          businessName: pro.business_name,
          fullName: profile?.full_name || "Pro",
          avatarUrl: null,
          location: pro.location,
          priceMin: pro.price_min ? Number(pro.price_min) : null,
          priceMax: pro.price_max ? Number(pro.price_max) : null,
          avgRating: Number(avgRating),
          reviewCount: Number(reviewCount),
          isVerified: pro.is_verified || false,
          hasLicense: (licenses?.length || 0) > 0,
          serviceSlug: services?.[0]?.service_slug || "",
          categorySlug: services?.[0]?.category_slug || "",
        });
      }

      // Sort by rating desc, then review count desc
      enriched.sort((a, b) => {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return b.reviewCount - a.reviewCount;
      });

      setPros(enriched);
      setLoading(false);
    };

    fetchSimilarPros();
  }, [currentProId, serviceSlug, categorySlug]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (pros.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-secondary" />
        <h3 className="font-heading font-bold text-foreground">Better Match?</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Based on ratings, pricing, and availability, these pros might also be a great fit:
      </p>

      <div className="space-y-3">
        {pros.map((pro) => (
          <ProCard key={pro.id} pro={pro} />
        ))}
      </div>

      {categorySlug && serviceSlug && (
        <Button variant="ghost" size="sm" className="w-full gap-1" asChild>
          <Link to={`/services/${categorySlug}/${serviceSlug}/pros`}>
            View All Pros <ArrowRight size={14} />
          </Link>
        </Button>
      )}
    </div>
  );
}
