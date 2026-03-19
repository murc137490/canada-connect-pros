import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { serviceCategories, getAllServices } from "@/data/services";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCategoryName } from "@/i18n/constants";
import { getServiceName } from "@/i18n/serviceTranslations";
import { geocodeAddress, distanceKm } from "@/lib/geocode";
import { ArrowLeft, ArrowRight, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProCard, { type ProCardData } from "@/components/pro/ProCard";
import StarBorder from "@/components/StarBorder";
import GradientText from "@/components/GradientText";

export default function ProListPage() {
  const { categorySlug, serviceSlug } = useParams<{ categorySlug: string; serviceSlug: string }>();
  const [searchParams] = useSearchParams();
  const locationQuery = searchParams.get("location")?.trim() || "";
  const { locale, t } = useLanguage();
  const [pros, setPros] = useState<ProCardData[]>([]);
  const [topPicks, setTopPicks] = useState<ProCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [sortBy, setSortBy] = useState(locationQuery ? "distance" : "rating");

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
        .in("id", proIds)
        .eq("is_verified", true);

      if (!proData) { setPros([]); setLoading(false); return; }

      let coords: { lat: number; lng: number } | null = null;
      if (locationQuery) {
        const geo = await geocodeAddress(locationQuery);
        if (geo) {
          coords = { lat: geo.lat, lng: geo.lng };
          setUserCoords(coords);
        }
      }

      const enriched: ProCardData[] = [];
      for (const pro of proData) {
        const [profileRes, ratingRes, licenseRes, photosRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", pro.user_id).single(),
          supabase.rpc("get_pro_avg_rating", { p_pro_profile_id: pro.id }),
          supabase.from("pro_licenses").select("is_verified").eq("pro_profile_id", pro.id).eq("is_verified", true).limit(1),
          supabase.from("pro_photos").select("url, is_primary").eq("pro_profile_id", pro.id).order("is_primary", { ascending: false }).limit(1),
        ]);
        const primaryPhoto = (photosRes.data as { url: string }[] | null)?.[0];
        const proLat = pro.latitude != null ? Number(pro.latitude) : null;
        const proLng = pro.longitude != null ? Number(pro.longitude) : null;
        const distance =
          coords && proLat != null && proLng != null
            ? distanceKm(coords.lat, coords.lng, proLat, proLng)
            : null;
        enriched.push({
          id: pro.id,
          businessName: pro.business_name,
          fullName: profileRes.data?.full_name || t.common.proFallback,
          avatarUrl: primaryPhoto?.url ?? null,
          location: pro.location ?? null,
          priceMin: pro.price_min ? Number(pro.price_min) : null,
          priceMax: pro.price_max ? Number(pro.price_max) : null,
          avgRating: Number(ratingRes.data?.[0]?.avg_rating || 0),
          reviewCount: Number(ratingRes.data?.[0]?.review_count || 0),
          isVerified: pro.is_verified || false,
          hasLicense: (licenseRes.data?.length || 0) > 0,
          serviceSlug: serviceSlug || "",
          categorySlug: categorySlug || "",
          distanceKm: distance,
        });
      }

      setPros(enriched);

      // Top picks: top 3 for this category (50+ bookings OR 40+ reviews)
      try {
        const { data: picks } = await supabase.rpc("get_top_picks", { p_category_slug: categorySlug || "" });
        if (picks && Array.isArray(picks) && picks.length > 0) {
          const pickIds = new Set((picks as { pro_profile_id: string }[]).map((r) => r.pro_profile_id));
          setTopPicks(enriched.filter((p) => pickIds.has(p.id)).slice(0, 3));
        } else {
          setTopPicks([]);
        }
      } catch {
        setTopPicks([]);
      }

      setLoading(false);
    };

    fetchPros();
  }, [categorySlug, serviceSlug, locationQuery]);

  // Sort; exclude top pick IDs from main list so they only appear in Top picks section
  const topPickIds = new Set(topPicks.map((p) => p.id));
  const otherPros = pros.filter((p) => !topPickIds.has(p.id));
  const sorted = [...otherPros].sort((a, b) => {
    switch (sortBy) {
      case "distance":
        return (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999);
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
            to={category ? `/services/${category.slug}` : "/services"}
            className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground mb-4"
          >
            <ArrowLeft size={16} /> {t.common.backTo} {category ? getCategoryName(category, locale) : t.nav?.services ?? "Services"}
          </Link>
          <h1 className="font-heading text-3xl font-extrabold">
            {service ? getServiceName(service.slug, locale, service.name) : t.common.service} {t.common.pros}
          </h1>
          <p className="text-primary-foreground/70 mt-1">
            {category ? getCategoryName(category, locale) : ""} · {t.services.findPros}
          </p>
        </div>
      </div>

      <div className="container py-8">
        {/* Sort/filter bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {pros.length} {pros.length !== 1 ? t.services.professionalsAvailablePlural : t.services.professionalsAvailable} {t.services.available}
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locationQuery && (
                  <SelectItem value="distance">{t.services.sortDistance ?? "Distance (nearest)"}</SelectItem>
                )}
                <SelectItem value="rating">{t.services.sortRating}</SelectItem>
                <SelectItem value="reviews">{t.services.sortReviews}</SelectItem>
                <SelectItem value="price-low">{t.services.sortPriceLow}</SelectItem>
                <SelectItem value="price-high">{t.services.sortPriceHigh}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : pros.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-4">
              {t.services.noProsYet}
            </p>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" asChild>
              <Link to="/join-pros">{t.services.becomeFirstPro}</Link>
            </Button>
          </div>
        ) : (
          <>
            {topPicks.length > 0 && (
              <div className="mb-8">
                <h2 className="font-heading text-xl font-bold text-foreground mb-4">
                  {t.services.topPicksTitle}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {t.services.topPicksEligibility}
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  {topPicks.map((pro) => (
                    <ProCard key={pro.id} pro={pro} />
                  ))}
                </div>
              </div>
            )}
            {(topPicks.length > 0 && sorted.length > 0) && (
              <h2 className="font-heading text-lg font-semibold text-foreground mb-4">
                {t.services.allPros}
              </h2>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {sorted.length > 0 ? sorted.map((pro) => (
                <ProCard key={pro.id} pro={pro} />
              )) : null}
            </div>

            {/* Are you a [service] professional? CTA */}
            {service && (
              <StarBorder as="div" className="w-full max-w-2xl mx-auto mt-12" color="hsl(var(--primary))" speed="5s" thickness={2}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-3">
                  <Sparkles size={20} className="text-primary shrink-0" />
                  <GradientText colors={["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))"]} animationSpeed={6} className="font-heading font-bold text-lg">
                    {(t.services.areYouServicePro ?? "Are you a {service} professional?").replace("{service}", getServiceName(service.slug, locale, service.name))}
                  </GradientText>
                </div>
                <p className="text-muted-foreground mb-5 text-sm">
                  {t.services.ctaThatCouldBeYou ?? "That could be you here! Join our growing network of Canadian service pros and start getting leads today."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2" asChild>
                    <Link to="/join-pros">{t.joinPros?.becomePro ?? "Become a Pro"} <ArrowRight size={18} /></Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link to="/auth?mode=signup">{t.auth?.createAccount ?? "Create an Account"}</Link>
                  </Button>
                </div>
              </StarBorder>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
