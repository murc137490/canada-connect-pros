import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { serviceCategories, getAllServices } from "@/data/services";
import { ArrowLeft, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProCard, { type ProCardData } from "@/components/pro/ProCard";

export default function ProListPage() {
  const { categorySlug, serviceSlug } = useParams<{ categorySlug: string; serviceSlug: string }>();
  const [pros, setPros] = useState<ProCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("rating");

  const category = serviceCategories.find((c) => c.slug === categorySlug);
  const allServices = getAllServices();
  const service = allServices.find(
    (s) => s.slug === serviceSlug && s.categorySlug === categorySlug
  );

  useEffect(() => {
    const fetchPros = async () => {
      setLoading(true);

      // Find pro_profiles that have this service
      const { data: proServices } = await supabase
        .from("pro_services")
        .select("pro_profile_id")
        .eq("service_slug", serviceSlug || "")
        .eq("category_slug", categorySlug || "");

      if (!proServices || proServices.length === 0) {
        setPros([]);
        setLoading(false);
        return;
      }

      const proIds = proServices.map((ps) => ps.pro_profile_id);

      const { data: proData } = await supabase
        .from("pro_profiles")
        .select("*")
        .in("id", proIds);

      if (!proData) { setPros([]); setLoading(false); return; }

      const enriched: ProCardData[] = [];
      for (const pro of proData) {
        const [profileRes, ratingRes, licenseRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", pro.user_id).single(),
          supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: pro.id }),
          supabase.from("pro_licenses").select("is_verified").eq("pro_profile_id", pro.id).eq("is_verified", true).limit(1),
        ]);

        enriched.push({
          id: pro.id,
          businessName: pro.business_name,
          fullName: profileRes.data?.full_name || "Pro",
          avatarUrl: null,
          location: pro.location,
          priceMin: pro.price_min ? Number(pro.price_min) : null,
          priceMax: pro.price_max ? Number(pro.price_max) : null,
          avgRating: Number(ratingRes.data?.[0]?.avg_rating || 0),
          reviewCount: Number(ratingRes.data?.[0]?.review_count || 0),
          isVerified: pro.is_verified || false,
          hasLicense: (licenseRes.data?.length || 0) > 0,
          serviceSlug: serviceSlug || "",
          categorySlug: categorySlug || "",
        });
      }

      setPros(enriched);
      setLoading(false);
    };

    fetchPros();
  }, [categorySlug, serviceSlug]);

  // Sort
  const sorted = [...pros].sort((a, b) => {
    switch (sortBy) {
      case "rating": return b.avgRating - a.avgRating;
      case "price-low": return (a.priceMin || 0) - (b.priceMin || 0);
      case "price-high": return (b.priceMax || 0) - (a.priceMax || 0);
      case "reviews": return b.reviewCount - a.reviewCount;
      default: return 0;
    }
  });

  return (
    <Layout>
      <div className="bg-primary text-primary-foreground">
        <div className="container py-10">
          <Link
            to={`/services/${categorySlug}/${serviceSlug}`}
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-4"
          >
            <ArrowLeft size={16} /> Back to {service?.name || "Service"}
          </Link>
          <h1 className="font-heading text-3xl font-extrabold">
            {service?.name || "Service"} Pros
          </h1>
          <p className="text-primary-foreground/70 mt-1">
            {category?.name} · Find the best professionals near you
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Sort/filter bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {pros.length} professional{pros.length !== 1 ? "s" : ""} available
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="reviews">Most Reviews</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-4">
              No pros available for this service yet.
            </p>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
              <Link to="/join-pros">Become the First Pro</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sorted.map((pro) => (
              <ProCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
